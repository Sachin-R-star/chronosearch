import { SearchProvider, WebSearchOptions, WebSearchToolInput } from './types.js';
import { SearchToolResult, SearchResultItem } from '../agent/types.js';
import { DuckDuckGoSearchProvider } from './providers/duckduckgo.js';
import { TavilySearchProvider } from './providers/tavily.js';
import { BraveSearchProvider } from './providers/brave.js';
import { SerperSearchProvider } from './providers/serper.js';
import { AppConfig, config } from '../config.js';

export class WebSearchTool {
  private primaryProvider: SearchProvider;
  private fallbackProvider: SearchProvider;
  private cache: Map<string, { result: SearchToolResult; expires: number }> = new Map();
  private cacheTTLMs = 5 * 60 * 1000; // 5 min memory cache

  constructor(cfg: AppConfig = config) {
    this.fallbackProvider = new DuckDuckGoSearchProvider();

    switch (cfg.search.provider) {
      case 'tavily':
        this.primaryProvider = new TavilySearchProvider(cfg.search.tavilyApiKey);
        break;
      case 'brave':
        this.primaryProvider = new BraveSearchProvider(cfg.search.braveApiKey);
        break;
      case 'serper':
        this.primaryProvider = new SerperSearchProvider(cfg.search.serperApiKey);
        break;
      default:
        this.primaryProvider = this.fallbackProvider;
        break;
    }

    if (!this.primaryProvider.isAvailable()) {
      this.primaryProvider = this.fallbackProvider;
    }
  }

  public getProviderName(): string {
    return this.primaryProvider.name;
  }

  /**
   * The ONE TOOL: web_search
   * Executes a web search with automatic fallback and caching.
   */
  public async execute(input: WebSearchToolInput): Promise<SearchToolResult> {
    const cacheKey = `${input.query}:${JSON.stringify(input.options || {})}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.result;
    }

    let result: SearchToolResult;

    try {
      if (this.primaryProvider.isAvailable()) {
        result = await this.primaryProvider.search(input.query, input.options);
      } else {
        result = await this.fallbackProvider.search(input.query, input.options);
      }

      // If primary returned 0 results and is not DDG, try fallback
      if (result.results.length === 0 && this.primaryProvider !== this.fallbackProvider) {
        result = await this.fallbackProvider.search(input.query, input.options);
      }
    } catch (err) {
      console.warn(`Search provider ${this.primaryProvider.name} failed, cascading to fallback:`, err);
      result = await this.fallbackProvider.search(input.query, input.options);
    }

    this.cache.set(cacheKey, {
      result,
      expires: Date.now() + this.cacheTTLMs,
    });

    return result;
  }

  /**
   * Executes multiple search queries in parallel.
   * Crucial for answering fast when verifying multiple entities or dimensions.
   */
  public async executeParallel(inputs: WebSearchToolInput[]): Promise<SearchToolResult[]> {
    const promises = inputs.map((input) => this.execute(input));
    const settled = await Promise.allSettled(promises);

    return settled.map((s, idx) => {
      if (s.status === 'fulfilled') {
        return s.value;
      }
      return {
        query: inputs[idx].query,
        results: [],
        latencyMs: 0,
        provider: 'failed',
      };
    });
  }

  /**
   * Deduplicates search results across multiple queries and ranks them.
   */
  public deduplicateResults(searchToolResults: SearchToolResult[]): SearchResultItem[] {
    const seenUrls = new Set<string>();
    const merged: SearchResultItem[] = [];

    for (const toolResult of searchToolResults) {
      for (const item of toolResult.results) {
        // Normalize URL
        const cleanUrl = item.url.replace(/\/$/, '').toLowerCase();
        if (!seenUrls.has(cleanUrl) && item.title && item.snippet) {
          seenUrls.add(cleanUrl);
          merged.push(item);
        }
      }
    }

    return merged;
  }
}

export const defaultSearchTool = new WebSearchTool();

