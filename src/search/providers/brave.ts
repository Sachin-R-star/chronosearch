import { SearchProvider, WebSearchOptions } from '../types.js';
import { SearchResultItem, SearchToolResult } from '../../agent/types.js';

export class BraveSearchProvider implements SearchProvider {
  public name = 'brave';
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
      throw new Error('Brave API key not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    try {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.set('q', query);
      url.searchParams.set('count', String(options.maxResults || 5));

      if (options.recency && options.recency !== 'any') {
        const freshnessMap: Record<string, string> = {
          day: 'pd',
          week: 'pw',
          month: 'pm',
          year: 'py',
        };
        url.searchParams.set('freshness', freshnessMap[options.recency] || 'pm');
      }

      const res = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': this.apiKey!,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Brave Search API error (${res.status})`);
      }

      const data = (await res.json()) as any;
      const results: SearchResultItem[] = [];

      if (data.web && Array.isArray(data.web.results)) {
        for (const item of data.web.results) {
          let domain = '';
          try {
            domain = new URL(item.url).hostname;
          } catch {
            domain = 'brave';
          }

          results.push({
            title: item.title || '',
            url: item.url || '',
            snippet: item.description || '',
            publishedDate: item.page_age,
            source: domain,
          });
        }
      }

      return {
        query,
        results,
        latencyMs: Date.now() - startTime,
        provider: 'brave',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
