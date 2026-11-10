import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AgentMessage, ConversationSession } from '../agent/types.js';
import { getSeedSessions } from './seeds.js';
import { defaultTemporalEngine } from '../agent/temporal.js';

export interface MemoryStoreOptions {
  storageFile?: string;
  referenceDate?: Date;
}

export class MemoryStore {
  private sessions: Map<string, ConversationSession> = new Map();
  private storageFile: string;
  private isLoaded: boolean = false;

  constructor(options: MemoryStoreOptions = {}) {
    const dataDir = path.resolve(process.cwd(), 'data');
    this.storageFile = options.storageFile || path.join(dataDir, 'sessions.json');
    this.init(options.referenceDate);
  }

  private init(referenceDate?: Date) {
    if (this.isLoaded) return;

    try {
      const dir = path.dirname(this.storageFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf-8');
        const parsed = JSON.parse(raw) as ConversationSession[];
        for (const session of parsed) {
          this.sessions.set(session.id, session);
        }
      } else {
        // Seed initial conversations for evaluation benchmarks
        const seeds = getSeedSessions(referenceDate || defaultTemporalEngine.getNow());
        for (const session of seeds) {
          this.sessions.set(session.id, session);
        }
        this.saveSync();
      }
    } catch (err) {
      console.warn('MemoryStore initialization warning:', err);
      // Fallback to in-memory seeds
      const seeds = getSeedSessions(referenceDate || defaultTemporalEngine.getNow());
      for (const session of seeds) {
        this.sessions.set(session.id, session);
      }
    }
    this.isLoaded = true;
  }

  private saveSync() {
    try {
      const dir = path.dirname(this.storageFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Array.from(this.sessions.values());
      fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist MemoryStore to disk:', err);
    }
  }

  public getAllSessions(): ConversationSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public getSession(id: string): ConversationSession | null {
    return this.sessions.get(id) || null;
  }

  public createSession(title: string, id?: string): ConversationSession {
    const now = new Date().toISOString();
    const sessionId = id || `session-${crypto.randomUUID()}`;
    const newSession: ConversationSession = {
      id: sessionId,
      title,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    this.sessions.set(sessionId, newSession);
    this.saveSync();
    return newSession;
  }

  public addMessage(
    sessionId: string,
    message: Omit<AgentMessage, 'id' | 'sessionId'> & { id?: string }
  ): AgentMessage {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = this.createSession('New Conversation', sessionId);
    }

    const fullMessage: AgentMessage = {
      id: message.id || `msg-${crypto.randomUUID()}`,
      sessionId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp || new Date().toISOString(),
      metadata: message.metadata,
    };

    session.messages.push(fullMessage);
    session.updatedAt = fullMessage.timestamp;

    // Auto-update title if it's the first user message and session has default title
    if (session.title === 'New Conversation' && message.role === 'user') {
      session.title = message.content.slice(0, 45) + (message.content.length > 45 ? '...' : '');
    }

    this.saveSync();
    return fullMessage;
  }

  /**
   * Search messages specifically by a calendar date (YYYY-MM-DD).
   */
  public findMessagesByDate(dateISO: string): AgentMessage[] {
    const results: AgentMessage[] = [];
    for (const session of this.sessions.values()) {
      for (const msg of session.messages) {
        if (msg.timestamp.startsWith(dateISO)) {
          results.push(msg);
        }
      }
    }
    return results;
  }

  /**
   * Find a session or messages matching a topic or temporal anchor.
   * Resolves queries like "What did I ask you on 3 November?" or "Last Tuesday I asked about Postgres"
   */
  public findSessionByTopicOrDate(
    query: string,
    anchorDateISO?: string
  ): { session: ConversationSession; matchedMessages: AgentMessage[]; score: number } | null {
    const lowerQuery = query.toLowerCase();
    const queryTokens = lowerQuery
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['what', 'when', 'did', 'ask', 'you', 'the', 'and', 'for', 'are', 'about', 'has', 'any', 'pricing'].includes(w));

    let bestMatch: { session: ConversationSession; matchedMessages: AgentMessage[]; score: number } | null = null;

    for (const session of this.sessions.values()) {
      let score = 0;
      const matchedMsgs: AgentMessage[] = [];

      // Check temporal match
      const sessionDate = session.createdAt.split('T')[0];
      const hasDateMatch = anchorDateISO && (sessionDate === anchorDateISO || session.messages.some((m) => m.timestamp.startsWith(anchorDateISO)));

      if (hasDateMatch) {
        score += 50; // Heavy temporal alignment bonus
      }

      // Check semantic / keyword match on session title & tags
      for (const tag of session.tags || []) {
        if (lowerQuery.includes(tag.toLowerCase())) {
          score += 15;
        }
      }
      for (const token of queryTokens) {
        if (session.title.toLowerCase().includes(token)) {
          score += 10;
        }
      }

      // Check message contents
      for (const msg of session.messages) {
        let msgScore = 0;
        const lowerContent = msg.content.toLowerCase();

        if (anchorDateISO && msg.timestamp.startsWith(anchorDateISO)) {
          msgScore += 20;
        }

        for (const token of queryTokens) {
          if (lowerContent.includes(token)) {
            msgScore += 8;
          }
        }

        if (msgScore > 0) {
          score += msgScore;
          matchedMsgs.push(msg);
        }
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { session, matchedMessages: matchedMsgs, score };
      }
    }

    return bestMatch;
  }

  /**
   * Global keyword search across all conversation history.
   */
  public searchAcrossAllSessions(query: string, limit: number = 5): AgentMessage[] {
    const lower = query.toLowerCase();
    const results: { msg: AgentMessage; score: number }[] = [];

    for (const session of this.sessions.values()) {
      for (const msg of session.messages) {
        if (msg.role === 'system') continue;
        const content = msg.content.toLowerCase();
        let score = 0;
        if (content.includes(lower)) score += 10;

        const tokens = lower.split(/\s+/).filter((t) => t.length > 2);
        for (const t of tokens) {
          if (content.includes(t)) score += 2;
        }

        if (score > 0) {
          results.push({ msg, score });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map((r) => r.msg);
  }
}

export const defaultMemoryStore = new MemoryStore();
