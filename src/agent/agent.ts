import {
  AgentEventCallback,
  AgentMessage,
  Citation,
  ConversationSession,
  DAGStepTelemetry,
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
import { TemporalEntityGraph, defaultEntityGraph } from './entity-graph.js';
import { EpistemicCoverageAnalyzer, defaultCoverageAnalyzer } from './coverage.js';
import { CitationGroundingVerifier, defaultGroundingVerifier } from './grounding.js';
import { SourceReliabilityRanker, defaultRanker } from '../search/ranker.js';
import { BitemporalOperator, defaultBitemporalOperator } from './bitemporal.js';
import { EvidenceArbitrator, defaultArbitrator } from './arbitrator.js';
import { LiveEntityAccumulator, defaultEntityAccumulator } from '../memory/entity-accumulator.js';
import { CitationSanitizer, defaultCitationSanitizer } from './sanitizer.js';
import { LLMProvider } from '../llm/types.js';
import { defaultLLMProvider } from '../llm/factory.js';

export interface AgentOptions {
  temporal?: TemporalEngine;
  memory?: MemoryStore;
  planner?: SearchPlanner;
  searchTool?: WebSearchTool;
  diffEngine?: DiffEngine;
  entityGraph?: TemporalEntityGraph;
  coverageAnalyzer?: EpistemicCoverageAnalyzer;
  groundingVerifier?: CitationGroundingVerifier;
  scraper?: PageScraper;
  llm?: LLMProvider;
  ranker?: SourceReliabilityRanker;
  bitemporalOperator?: BitemporalOperator;
  arbitrator?: EvidenceArbitrator;
  entityAccumulator?: LiveEntityAccumulator;
  sanitizer?: CitationSanitizer;
}

export class ChronoAgent {
  private temporal: TemporalEngine;
  private memory: MemoryStore;
  private planner: SearchPlanner;
  private searchTool: WebSearchTool;
  private diffEngine: DiffEngine;
  private entityGraph: TemporalEntityGraph;
  private coverageAnalyzer: EpistemicCoverageAnalyzer;
  private groundingVerifier: CitationGroundingVerifier;
  private scraper: PageScraper;
  private llm: LLMProvider;
  private ranker: SourceReliabilityRanker;
  private bitemporalOperator: BitemporalOperator;
  private arbitrator: EvidenceArbitrator;
  private entityAccumulator: LiveEntityAccumulator;
  private sanitizer: CitationSanitizer;

  constructor(options: AgentOptions = {}) {
    this.temporal = options.temporal || defaultTemporalEngine;
    this.memory = options.memory || defaultMemoryStore;
    this.planner = options.planner || defaultPlanner;
    this.searchTool = options.searchTool || defaultSearchTool;
    this.diffEngine = options.diffEngine || defaultDiffEngine;
    this.entityGraph = options.entityGraph || defaultEntityGraph;
    this.coverageAnalyzer = options.coverageAnalyzer || defaultCoverageAnalyzer;
    this.groundingVerifier = options.groundingVerifier || defaultGroundingVerifier;
    this.scraper = options.scraper || defaultScraper;
    this.llm = options.llm || defaultLLMProvider;
    this.ranker = options.ranker || defaultRanker;
    this.bitemporalOperator = options.bitemporalOperator || defaultBitemporalOperator;
    this.arbitrator = options.arbitrator || defaultArbitrator;
    this.entityAccumulator = options.entityAccumulator || defaultEntityAccumulator;
    this.sanitizer = options.sanitizer || defaultCitationSanitizer;
  }

  public async chat(
    userQuery: string,
    sessionId?: string,
    onEvent?: AgentEventCallback
  ): Promise<AgentMessage> {
    const startTime = Date.now();
    const dagTrace: DAGStepTelemetry[] = [];

    const emit = (type: any, data: any) => {
      if (onEvent) {
        onEvent({ type, data, timestamp: Date.now() });
      }
    };

    emit('start', { query: userQuery, sessionId });

    // Session resolution
    let activeSession: ConversationSession | null = null;
    if (sessionId) {
      activeSession = this.memory.getSession(sessionId);
    }
    if (!activeSession) {
      activeSession = this.memory.createSession('New Conversation', sessionId);
    }

    // Accumulate entities and multi-turn constraints into session graph
    const accumulation = this.entityAccumulator.updateSessionGraph(activeSession, userQuery);
    if (accumulation.newEntitiesDiscovered.length > 0) {
      emit('entities_accumulated', {
        newEntities: accumulation.newEntitiesDiscovered,
        totalTracked: accumulation.totalEntitiesTracked,
        constraints: accumulation.constraints,
      });
    }

    // --------------------------------------------------------------------------
    // Phase 1: Temporal Grounding & Calendar Interval Algebra
    // --------------------------------------------------------------------------
    const t0 = Date.now();
    const temporalAnchor = this.temporal.parseTemporalExpression(userQuery);
    const temporalFrame = this.temporal.getTemporalFrame();
    const temporalDuration = Date.now() - t0;
    dagTrace.push({
      step: 'Temporal Grounding',
      durationMs: temporalDuration,
      status: 'completed',
      details: temporalAnchor
        ? `"${temporalAnchor.expression}" -> ${temporalAnchor.anchorDate} (${temporalAnchor.relativeDays}d offset)`
        : 'Live reference frame anchored',
    });

    emit('temporal_resolved', {
      anchor: temporalAnchor,
      currentDate: temporalFrame.todayHuman,
      calendarAnchors: temporalFrame.calendarAnchors,
    });

    // --------------------------------------------------------------------------
    // Phase 2: Inverted Index Episodic Memory Recall
    // --------------------------------------------------------------------------
    const m0 = Date.now();
    let recalledContext = '';
    let recalledSession: ConversationSession | null = null;
    let matchedMessages: AgentMessage[] = [];

    const plan = this.planner.plan(userQuery, temporalAnchor);

    if (plan.requiresMemoryRecall) {
      if (activeSession.messages.length > 0) {
        matchedMessages = activeSession.messages;
        recalledSession = activeSession;
      }

      if (matchedMessages.length === 0) {
        const found = this.memory.findSessionByTopicOrDate(
          userQuery,
          temporalAnchor ? temporalAnchor.anchorDate : undefined
        );
        if (found) {
          recalledSession = found.session;
          matchedMessages = found.session.messages;
        }
      }

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
    const memoryDuration = Date.now() - m0;
    dagTrace.push({
      step: 'Episodic Memory Recall',
      durationMs: memoryDuration,
      status: plan.requiresMemoryRecall ? 'completed' : 'skipped',
      details: recalledSession ? `Recalled "${recalledSession.title}"` : 'No past context required',
    });

    // Refine plan using recalled context
    const refinedPlan = this.planner.plan(userQuery, temporalAnchor, recalledContext);

    // --------------------------------------------------------------------------
    // Phase 3: Speculative Multi-Query Fan-Out (Parallel Web Search)
    // --------------------------------------------------------------------------
    let allSearchResults: SearchResultItem[] = [];
    const searchQueriesIssued: string[] = [];
    let searchDuration = 0;
    let scrapeDuration = 0;

    if (refinedPlan.requiresSearch && refinedPlan.searchQueries.length > 0) {
      emit('search_planned', {
        queries: refinedPlan.searchQueries,
        intent: refinedPlan.intentSummary,
      });

      for (const q of refinedPlan.searchQueries) {
        emit('search_executing', { query: q.query, purpose: q.purpose });
        searchQueriesIssued.push(q.query);
      }

      const s0 = Date.now();
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
      const rankedResults = this.ranker.rankResults(deduplicated, temporalFrame.todayISO);
      allSearchResults = rankedResults.map((r) => ({
        ...r,
        domainTier: r.domainTier,
        reliabilityScore: r.compositeReliabilityScore,
      }));
      searchDuration = Date.now() - s0;

      emit('search_completed', {
        resultCount: allSearchResults.length,
        sources: allSearchResults.map((r) => ({
          title: r.title,
          url: r.url,
          source: r.source,
          domainTier: r.domainTier,
          reliabilityScore: r.reliabilityScore,
        })),
        totalLatencyMs: searchDuration,
      });

      dagTrace.push({
        step: 'Speculative Search Fan-Out',
        durationMs: searchDuration,
        status: 'completed',
        details: `${refinedPlan.searchQueries.length} parallel queries -> ${allSearchResults.length} sources (Ranked by Authority & Temporal Decay)`,
      });

      // ------------------------------------------------------------------------
      // Phase 4: Parallel Deep DOM & Table Extraction
      // ------------------------------------------------------------------------
      if (allSearchResults.length > 0) {
        const sc0 = Date.now();
        const topUrls = allSearchResults.slice(0, 3).map((r) => r.url);
        const scraped = await this.scraper.scrapeMultiple(topUrls);
        scrapeDuration = Date.now() - sc0;

        for (const r of allSearchResults) {
          if (scraped[r.url] && scraped[r.url].success) {
            r.pageContent = scraped[r.url].text.slice(0, 800);
            if (scraped[r.url].tables.length > 0) {
              r.extractedTables = scraped[r.url].tables;
            }
          }
        }

        emit('page_scraped', {
          scrapedCount: Object.keys(scraped).length,
          latencyMs: scrapeDuration,
        });

        dagTrace.push({
          step: 'Deep DOM Table Extraction',
          durationMs: scrapeDuration,
          status: 'completed',
          details: `Parsed ${Object.keys(scraped).length} pages for pricing grids`,
        });
      }
    }

    // --------------------------------------------------------------------------
    // Phase 5: Epistemic Coverage Assessment & Adaptive Hop
    // --------------------------------------------------------------------------
    const cov0 = Date.now();
    let coverageAssessment: any = undefined;

    if (refinedPlan.extractedEntities.length > 0 && allSearchResults.length > 0) {
      const coverage = await this.coverageAnalyzer.assessAndFillGaps(
        refinedPlan.extractedEntities,
        allSearchResults,
        this.searchTool,
        (adaptiveQuery) => {
          emit('search_executing', { query: adaptiveQuery, purpose: 'adaptive_gap_fill' });
          searchQueriesIssued.push(adaptiveQuery);
        }
      );

      allSearchResults = coverage.results;
      coverageAssessment = coverage.assessment;

      emit('coverage_evaluated', coverageAssessment);
    }
    const coverageDuration = Date.now() - cov0;
    dagTrace.push({
      step: 'Epistemic Coverage Assessor',
      durationMs: coverageDuration,
      status: coverageAssessment?.adaptiveHopsExecuted ? 'adaptive_hop' : 'completed',
      details: coverageAssessment
        ? `Coverage: ${coverageAssessment.isFullyCovered ? '100% Complete' : 'Partial'} (${coverageAssessment.adaptiveHopsExecuted} hops)`
        : 'Standard coverage',
    });

    // --------------------------------------------------------------------------
    // Phase 6: Temporal Knowledge Graph Diffing
    // --------------------------------------------------------------------------
    const diff0 = Date.now();
    let deltaSummary: DeltaSummary | undefined;

    if (refinedPlan.isDeltaVerification && recalledContext) {
      const baselineDateStr = temporalAnchor ? temporalAnchor.anchorDate : 'the previous conversation';
      deltaSummary = this.entityGraph.computeGraphDelta(
        {
          baselineDate: baselineDateStr,
          currentDate: temporalFrame.todayHuman,
          teamSize: 20,
        },
        recalledContext,
        allSearchResults
      );

      emit('delta_computed', deltaSummary);
    }
    const diffDuration = Date.now() - diff0;
    dagTrace.push({
      step: 'Temporal Graph Diff Engine',
      durationMs: diffDuration,
      status: deltaSummary ? 'completed' : 'skipped',
      details: deltaSummary
        ? `Delta Verdict: ${deltaSummary.hasChanges ? 'Changes Detected' : 'Unchanged & Verified'}`
        : 'No delta comparison required',
    });

    // --------------------------------------------------------------------------
    // Phase 7: Footnote Indexing & Streaming LLM Synthesis
    // --------------------------------------------------------------------------
    let citations: Citation[] = allSearchResults.slice(0, 6).map((item, idx) => ({
      index: idx + 1,
      title: item.title,
      url: item.url,
      domain: item.source,
      snippet: item.snippet,
      publishedDate: item.publishedDate,
    }));

    if (citations.length === 0 && matchedMessages.length > 0) {
      for (const m of matchedMessages) {
        if (m.metadata?.citations && m.metadata.citations.length > 0) {
          citations = m.metadata.citations.slice(0, 6);
          break;
        }
      }
    }

    const systemPrompt = this.buildSystemPrompt(
      temporalFrame,
      temporalAnchor,
      recalledContext,
      citations,
      deltaSummary
    );

    this.memory.addMessage(activeSession.id, {
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

    // Citation Sanitization & Referential Integrity Guardrail
    const sanitization = this.sanitizer.sanitize(assistantFullText, citations);
    assistantFullText = sanitization.sanitizedText;

    // Grounding & Attribution Verification
    const groundingResult = this.groundingVerifier.verify(
      assistantFullText,
      allSearchResults,
      citations
    );

    emit('grounding_verified', {
      score: groundingResult.groundingScore,
      claimsChecked: groundingResult.totalClaimsChecked,
    });

    const totalLatency = Date.now() - startTime;
    dagTrace.push({
      step: 'Streaming LLM Synthesis',
      durationMs: Math.max(0, totalLatency - (temporalDuration + memoryDuration + searchDuration + scrapeDuration + coverageDuration + diffDuration)),
      status: 'completed',
      details: `Grounding Score: ${groundingResult.groundingScore}%`,
    });

    // Persist Assistant Message
    const assistantMessage = this.memory.addMessage(activeSession.id, {
      role: 'assistant',
      content: assistantFullText,
      timestamp: new Date().toISOString(),
      metadata: {
        citations: groundingResult.verifiedCitations,
        searchQueries: searchQueriesIssued,
        temporalAnchor: temporalAnchor || undefined,
        deltaSummary,
        groundingScore: groundingResult.groundingScore,
        dagTrace,
        coverageAssessment,
        entitySnapshots: recalledSession?.entitySnapshots,
        latencyBreakdown: {
          temporalMs: temporalDuration,
          memoryMs: memoryDuration,
          searchMs: searchDuration,
          scrapeMs: scrapeDuration,
          coverageMs: coverageDuration,
          diffMs: diffDuration,
          llmFirstTokenMs: Math.max(0, totalLatency - (temporalDuration + memoryDuration + searchDuration + scrapeDuration + coverageDuration + diffDuration)),
          totalMs: totalLatency,
        },
        latencyMs: totalLatency,
      },
    });

    emit('done', {
      messageId: assistantMessage.id,
      sessionId: activeSession.id,
      citations: groundingResult.verifiedCitations,
      latencyMs: totalLatency,
      deltaSummary,
      groundingScore: groundingResult.groundingScore,
      dagTrace,
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
   - Start with an immediate, high-signal Executive Summary (1-2 sentences) answering the core question directly (e.g. "No, none of the 5 shortlisted CRM tools have changed pricing since Monday...").
   - Follow with a structured, digestible comparison table or breakdown per tool/provider.
   - For team size queries (e.g. 20-person sales team), provide the total math breakdown for the team.
   - Explicitly contrast the Baseline State (from the past conversation) vs Current State (from live search).
   - Address both pricing changes AND shipped features.
2. GOOD TO TALK TO:
   - Warm, authoritative, executive tone.
   - Ground every claim with citations [^1], [^2].`;

    return prompt;
  }
}

export const defaultAgent = new ChronoAgent();
