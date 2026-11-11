export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Citation {
  index: number;
  url: string;
  title: string;
  domain: string;
  snippet?: string;
  publishedDate?: string;
}

export interface EntitySnapshot {
  name: string;
  category: 'crm' | 'database' | 'infra' | 'saas' | 'general';
  baselineDate: string;
  attributes: {
    pricingTiers?: Record<string, string | number>;
    teamSizeCalculations?: Record<string, string | number>;
    keyFeatures?: string[];
    recentReleases?: string[];
    [key: string]: any;
  };
}

export interface MessageMetadata {
  citations?: Citation[];
  searchQueries?: string[];
  recalledSessionId?: string;
  temporalAnchor?: TemporalAnchor;
  deltaSummary?: DeltaSummary;
  entitySnapshots?: EntitySnapshot[];
  latencyBreakdown?: {
    temporalMs: number;
    memoryMs: number;
    searchMs: number;
    scrapeMs: number;
    llmFirstTokenMs: number;
    totalMs: number;
  };
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
  entitySnapshots?: EntitySnapshot[];
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
  extractedTables?: string[];
  pageContent?: string;
}

export interface SearchToolResult {
  query: string;
  results: SearchResultItem[];
  latencyMs: number;
  provider: string;
}

export interface DeltaFact {
  entity: string;
  dimension: 'pricing' | 'product_release' | 'feature' | 'team_pricing' | 'staleness';
  baselineValue: string;
  currentValue: string;
  status: 'changed' | 'unchanged' | 'new_release' | 'uncertain';
  summary: string;
  sources: string[];
}

export interface DeltaSummary {
  hasChanges: boolean;
  verdict: string;
  baselineDate: string;
  currentDate: string;
  facts: DeltaFact[];
  teamCalculations?: {
    teamSize: number;
    baselineTotal: string;
    currentTotal: string;
  };
}

export type AgentEventType =
  | 'start'
  | 'temporal_resolved'
  | 'memory_recalled'
  | 'search_planned'
  | 'search_executing'
  | 'search_completed'
  | 'page_scraped'
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

// The ONE TOOL definition schema (OpenAI / Anthropic / Gemini compatible)
export const WEB_SEARCH_TOOL_DEFINITION = {
  name: 'web_search',
  description:
    'Search the live web for real-time information, pricing pages, product changelogs, release notes, and documentation.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up on the web.',
      },
      recency: {
        type: 'string',
        enum: ['day', 'week', 'month', 'year', 'any'],
        description: 'Optional freshness filter for recent updates.',
      },
      domains: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional list of domains to restrict search results to.',
      },
    },
    required: ['query'],
  },
};
