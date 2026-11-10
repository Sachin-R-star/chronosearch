import { SearchResultItem, SearchToolResult } from '../agent/types.js';

export interface WebSearchOptions {
  recency?: 'day' | 'week' | 'month' | 'year' | 'any';
  domains?: string[];
  maxResults?: number;
}

export interface WebSearchToolInput {
  query: string;
  options?: WebSearchOptions;
}

export interface SearchProvider {
  name: string;
  isAvailable(): boolean;
  search(query: string, options?: WebSearchOptions): Promise<SearchToolResult>;
}
