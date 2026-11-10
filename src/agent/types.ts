export type MessageRole = 'user' | 'assistant' | 'system';

export interface Citation {
  index: number;
  url: string;
  title: string;
  domain: string;
  snippet?: string;
  publishedDate?: string;
}

export interface MessageMetadata {
  citations?: Citation[];
  searchQueries?: string[];
  recalledSessionId?: string;
  temporalAnchor?: TemporalAnchor;
  deltaSummary?: DeltaSummary;
  latencyMs?: number;
}

export interface AgentMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  timestamp: string; // ISO 8601
  metadata?: MessageMetadata;
}

export interface ConversationSession {
  id: string;
  title: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  messages: AgentMessage[];
  tags?: string[];
}

export interface TemporalAnchor {
  expression: string; // e.g. "Monday", "3 November", "last Tuesday"
  anchorDate: string; // ISO YYYY-MM-DD
  dayOfWeek: string;  // e.g. "Tuesday"
  relativeDays: number; // e.g. -7
  isPastReference: boolean;
  searchFilterAfter?: string; // ISO YYYY-MM-DD for date-bounded searches
}

export interface SearchQuery {
  query: string;
  purpose: 'pricing' | 'changelog' | 'releases' | 'verification' | 'general';
  recency?: 'day' | 'week' | 'month' | 'year';
  domains?: string[];
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  source: string;
}

export interface SearchToolResult {
  query: string;
  results: SearchResultItem[];
  latencyMs: number;
  provider: string;
}

export interface DeltaFact {
  entity: string;
  dimension: 'pricing' | 'product_release' | 'feature' | 'staleness';
  baselineValue: string;
  currentValue: string;
  status: 'changed' | 'unchanged' | 'uncertain';
  summary: string;
  sources: string[];
}

export interface DeltaSummary {
  hasChanges: boolean;
  verdict: string;
  baselineDate: string;
  currentDate: string;
  facts: DeltaFact[];
}

export type AgentEventType =
  | 'start'
  | 'temporal_resolved'
  | 'memory_recalled'
  | 'search_planned'
  | 'search_executing'
  | 'search_completed'
  | 'delta_computed'
  | 'token'
  | 'done'
  | 'error';

export interface AgentEvent {
  type: AgentEventType;
  data: any;
  timestamp: number;
}

export type AgentEventCallback = (event: AgentEvent) => void;
