import { SearchProvider, WebSearchOptions } from '../types.js';
import { SearchResultItem, SearchToolResult } from '../../agent/types.js';

export class TavilySearchProvider implements SearchProvider {
  public name = 'tavily';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async search(query: string, options: WebSearchOptions = {}): Promise<SearchToolResult> {
    const startTime = Date.now();
    if (!this.isAvailable()) {
      throw new Error('Tavily API key not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    try {
      const payload: any = {
        api_key: this.apiKey,
        query,
        search_depth: 'basic',
        include_answer: true,
        max_results: options.maxResults || 5,
      };

      if (options.recency && options.recency !== 'any') {
        payload.time_range = options.recency;
      }
      if (options.domains && options.domains.length > 0) {
        payload.include_domains = options.domains;
      }

      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Tavily API error (${res.status}): ${errorText}`);
      }

      const data = (await res.json()) as any;
      const results: SearchResultItem[] = [];

      if (Array.isArray(data.results)) {
        for (const item of data.results) {
          let domain = '';
          try {
            domain = new URL(item.url).hostname;
          } catch {
            domain = 'tavily';
          }

          results.push({
            title: item.title || '',
            url: item.url || '',
            snippet: item.content || item.snippet || '',
            publishedDate: item.published_date,
            source: domain,
          });
        }
      }

      return {
        query,
        results,
        latencyMs: Date.now() - startTime,
        provider: 'tavily',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
