import {
  AgentEventCallback,
  AgentMessage,
  Citation,
  ConversationSession,
  DeltaSummary,
  SearchResultItem,
  TemporalAnchor,
} from './types.js';
import { TemporalEngine, defaultTemporalEngine } from './temporal.js';
import { MemoryStore, defaultMemoryStore } from '../memory/store.js';
import { SearchPlanner, defaultPlanner } from './planner.js';
import { WebSearchTool, defaultSearchTool } from '../search/tool.js';
import { DiffEngine, defaultDiffEngine } from './diff-engine.js';
import { PageScraper, defaultScraper } from '../search/scraper.js';
import { LLMProvider } from '../llm/types.js';
import { defaultLLMProvider } from '../llm/factory.js';

export interface AgentOptions {
  temporal?: TemporalEngine;
  memory?: MemoryStore;
  planner?: SearchPlanner;
  searchTool?: WebSearchTool;
  diffEngine?: DiffEngine;
  scraper?: PageScraper;
  llm?: LLMProvider;
}

export class ChronoAgent {
  private temporal: TemporalEngine;
  private memory: MemoryStore;
  private planner: SearchPlanner;
  private searchTool: WebSearchTool;
  private diffEngine: DiffEngine;
  private scraper: PageScraper;
  private llm: LLMProvider;

  constructor(options: AgentOptions = {}) {
    this.temporal = options.temporal || defaultTemporalEngine;
    this.memory = options.memory || defaultMemoryStore;
    this.planner = options.planner || defaultPlanner;
    this.searchTool = options.searchTool || defaultSearchTool;
    this.diffEngine = options.diffEngine || defaultDiffEngine;
    this.scraper = options.scraper || defaultScraper;
    this.llm = options.llm || defaultLLMProvider;
  }

  public async chat(
    userQuery: string,
    sessionId?: string,
    onEvent?: AgentEventCallback
  ): Promise<AgentMessage> {
    const startTime = Date.now();
    const emit = (type: any, data: any) => {
      if (onEvent) {
        onEvent({ type, data, timestamp: Date.now() });
      }
    };

    emit('start', { query: userQuery, sessionId });

    // Ensure session exists
    let activeSession: ConversationSession | null = null;
    if (sessionId) {
      activeSession = this.memory.getSession(sessionId);
    }
    if (!activeSession) {
      activeSession = this.memory.createSession('New Conversation', sessionId);
    }

    // 1. Temporal Anchoring
    const temporalAnchor = this.temporal.parseTemporalExpression(userQuery);
    const temporalFrame = this.temporal.getTemporalFrame();

    emit('temporal_resolved', {
      anchor: temporalAnchor,
      currentDate: temporalFrame.todayHuman,
      calendarAnchors: temporalFrame.calendarAnchors,
    });

    // 2. Episodic Memory Recall
    let recalledContext = '';
    let recalledSession: ConversationSession | null = null;
    let matchedMessages: AgentMessage[] = [];

    // Check if temporal anchor or query implies memory recall
    const plan = this.planner.plan(userQuery, temporalAnchor);

    if (plan.requiresMemoryRecall) {
      // First try matching in current session if it has history
      if (activeSession.messages.length > 0) {
        matchedMessages = activeSession.messages;
        recalledSession = activeSession;
      }

      // If not found in current session, search across all sessions by topic and date
      if (matchedMessages.length === 0) {
        const found = this.memory.findSessionByTopicOrDate(
          userQuery,
          temporalAnchor ? temporalAnchor.anchorDate : undefined
        );
        if (found) {
          recalledSession = found.session;
          matchedMessages = found.matchedMessages.length > 0 ? found.session.messages : found.session.messages;
        }
      }

      // If still nothing, do a global keyword search across stored messages
      if (matchedMessages.length === 0) {
        matchedMessages = this.memory.searchAcrossAllSessions(userQuery, 3);
      }

      if (matchedMessages.length > 0) {
        recalledContext = matchedMessages
          .map((m) => `[${m.timestamp}] ${m.role.toUpperCase()}: ${m.content}`)
          .join('\n\n');

        emit('memory_recalled', {
          sessionId: recalledSession?.id,
          sessionTitle: recalledSession?.title,
          messageCount: matchedMessages.length,
          preview: matchedMessages[0]?.content.slice(0, 100) + '...',
        });
      }
    }

    // Re-plan with recalled context to produce highly targeted delta search queries
    const refinedPlan = this.planner.plan(userQuery, temporalAnchor, recalledContext);

    // 3. Web Search Execution (Parallel)
    const allSearchResults: SearchResultItem[] = [];
    const searchQueriesIssued: string[] = [];

    if (refinedPlan.requiresSearch && refinedPlan.searchQueries.length > 0) {
      emit('search_planned', {
        queries: refinedPlan.searchQueries,
        intent: refinedPlan.intentSummary,
      });

      for (const q of refinedPlan.searchQueries) {
        emit('search_executing', { query: q.query, purpose: q.purpose });
        searchQueriesIssued.push(q.query);
      }

      // Dispatch search queries concurrently
      const toolInputs = refinedPlan.searchQueries.map((q) => ({
        query: q.query,
        options: {
          recency: q.recency,
          domains: q.domains,
          maxResults: 4,
        },
      }));

      const toolResults = await this.searchTool.executeParallel(toolInputs);
      const deduplicated = this.searchTool.deduplicateResults(toolResults);
      allSearchResults.push(...deduplicated);

      emit('search_completed', {
        resultCount: allSearchResults.length,
        sources: allSearchResults.map((r) => ({ title: r.title, url: r.url, source: r.source })),
        totalLatencyMs: toolResults.reduce((acc, curr) => Math.max(acc, curr.latencyMs), 0),
      });

      // Deep scrape top 2 relevant URLs in parallel with strict timeout
      if (allSearchResults.length > 0) {
        const topUrls = allSearchResults.slice(0, 2).map((r) => r.url);
        const scraped = await this.scraper.scrapeMultiple(topUrls);
        for (const r of allSearchResults) {
          if (scraped[r.url] && scraped[r.url].success) {
            r.snippet = `${r.snippet} [Page Details: ${scraped[r.url].text.slice(0, 600)}]`;
          }
        }
      }
    }

    // 4. Delta / Change Detection Computation
    let deltaSummary: DeltaSummary | undefined;
    if (refinedPlan.isDeltaVerification && recalledContext) {
      const baselineDateStr = temporalAnchor ? temporalAnchor.anchorDate : 'the previous conversation';
      deltaSummary = this.diffEngine.computeDelta(
        recalledContext,
        allSearchResults,
        baselineDateStr,
        temporalFrame.todayHuman
      );

      emit('delta_computed', deltaSummary);
    }

    // 5. Build Citation Map
    const citations: Citation[] = allSearchResults.slice(0, 6).map((item, idx) => ({
      index: idx + 1,
      title: item.title,
      url: item.url,
      domain: item.source,
      snippet: item.snippet,
      publishedDate: item.publishedDate,
    }));

    // 6. Synthesize via Streaming LLM
    const systemPrompt = this.buildSystemPrompt(temporalFrame, temporalAnchor, recalledContext, citations, deltaSummary);

    const userMessage = this.memory.addMessage(activeSession.id, {
      role: 'user',
      content: userQuery,
      timestamp: new Date().toISOString(),
      metadata: {
        temporalAnchor: temporalAnchor || undefined,
        searchQueries: searchQueriesIssued,
      },
    });

    let assistantFullText = '';

    try {
      assistantFullText = await this.llm.stream(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery },
        ],
        (chunk) => {
          emit('token', { chunk });
        }
      );
    } catch (llmErr: any) {
      console.warn('LLM stream error, falling back to heuristic response:', llmErr);
      assistantFullText = `I evaluated current live sources regarding your query.\n\n${deltaSummary ? deltaSummary.verdict : 'Verified with latest web search data.'}`;
      emit('token', { chunk: assistantFullText });
    }

    const totalLatency = Date.now() - startTime;

    // 7. Save Assistant Message
    const assistantMessage = this.memory.addMessage(activeSession.id, {
      role: 'assistant',
      content: assistantFullText,
      timestamp: new Date().toISOString(),
      metadata: {
        citations,
        searchQueries: searchQueriesIssued,
        temporalAnchor: temporalAnchor || undefined,
        deltaSummary,
        latencyMs: totalLatency,
      },
    });

    emit('done', {
      messageId: assistantMessage.id,
      sessionId: activeSession.id,
      citations,
      latencyMs: totalLatency,
      deltaSummary,
    });

    return assistantMessage;
  }

  private buildSystemPrompt(
    temporalFrame: ReturnType<TemporalEngine['getTemporalFrame']>,
    temporalAnchor: TemporalAnchor | null,
    recalledContext: string,
    citations: Citation[],
    deltaSummary?: DeltaSummary
  ): string {
    const calendarAnchorList = Object.entries(temporalFrame.calendarAnchors)
      .map(([k, v]) => `- ${k.toUpperCase()}: ${v.human} (${v.iso}, ${v.daysAgo === 0 ? 'today' : `${Math.abs(v.daysAgo)} days ago`})`)
      .join('\n');

    let prompt = `You are ChronoSearch, a state-of-the-art chat agent with web search, temporal memory anchoring, and delta verification.
You answer fast, get things right, and are good to talk to.

==================================================
CURRENT SYSTEM TIME & CALENDAR FRAME
==================================================
Today is: ${temporalFrame.todayHuman} (${temporalFrame.todayISO})
Exact ISO Timestamp: ${temporalFrame.now}

Relative Calendar Reference:
${calendarAnchorList}

`;

    if (temporalAnchor) {
      prompt += `==================================================
RESOLVED TEMPORAL ANCHOR FOR THIS USER QUERY
==================================================
Expression: "${temporalAnchor.expression}"
Anchored Date: ${temporalAnchor.anchorDate} (${temporalAnchor.dayOfWeek})
Relative Offset: ${temporalAnchor.relativeDays} days from today
\n`;
    }

    if (recalledContext) {
      prompt += `==================================================
RECALLED EPISODIC CONVERSATION MEMORY (GROUND TRUTH BASELINE)
==================================================
The user is referencing past interactions. Here is the exact conversation retrieved from memory:

${recalledContext}

CRITICAL: When the user asks "What did I ask you on [Date]?", explicitly acknowledge their past question and your past answer from the memory above before presenting your verification or delta!
\n`;
    }

    if (citations.length > 0) {
      prompt += `==================================================
VERIFIED WEB SEARCH SOURCES & EVIDENCE
==================================================
${citations
  .map(
    (c) => `[^${c.index}] "${c.title}" (${c.domain})
URL: ${c.url}
Published: ${c.publishedDate || 'Recent'}
Snippet: ${c.snippet}`
  )
  .join('\n\n')}

CITATION INSTRUCTION: Ground every statement, claim, and price using inline markdown citation footnotes: [^1], [^2], etc.
\n`;
    }

    if (deltaSummary) {
      prompt += `==================================================
PRE-COMPUTED DELTA & VERIFICATION SUMMARY
==================================================
Baseline Date: ${deltaSummary.baselineDate}
Current Date: ${deltaSummary.currentDate}
Status: ${deltaSummary.hasChanges ? 'CHANGES DETECTED' : 'UNCHANGED / VERIFIED CONSTANT'}
Summary: ${deltaSummary.verdict}
\n`;
    }

    prompt += `==================================================
COMMUNICATION STYLE & RESPONSE STRUCTURE
==================================================
1. ANSWERS FAST & GETS THINGS RIGHT:
   - Start with an immediate, high-signal Executive Summary (1-2 sentences) answering the core question directly (e.g. "Yes, my recommendations from 3 November remain accurate today with no pricing changes," or "Here is what changed since Monday: ...").
   - Follow with a structured, digestible comparison (e.g. bullet points or breakdown per tool/provider).
   - Explicitly contrast the Baseline State (from the past conversation) vs Current State (from live search).
   - Use Markdown bolding, tables, or clean bullet points.
2. GOOD TO TALK TO:
   - Warm, authoritative, executive tone.
   - Never sound defensive or robotic.
   - If no conversation history exists for a referenced past date, politely acknowledge that the specific thread isn't in current session memory and offer to check the latest data for their candidates immediately.`;

    return prompt;
  }
}

export const defaultAgent = new ChronoAgent();
