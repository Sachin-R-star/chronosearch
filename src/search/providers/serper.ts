import { SearchProvider, WebSearchOptions } from '../types.js';
import { SearchResultItem, SearchToolResult } from '../../agent/types.js';

export class SerperSearchProvider implements SearchProvider {
  public name = 'serper';
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
      throw new Error('Serper API key not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    try {
      const payload: any = {
        q: query,
        num: options.maxResults || 5,
      };

      if (options.recency === 'day') payload.tbs = 'qdr:d';
      else if (options.recency === 'week') payload.tbs = 'qdr:w';
      else if (options.recency === 'month') payload.tbs = 'qdr:m';
      else if (options.recency === 'year') payload.tbs = 'qdr:y';

      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Serper API error (${res.status})`);
      }

      const data = (await res.json()) as any;
      const results: SearchResultItem[] = [];

      if (Array.isArray(data.organic)) {
        for (const item of data.organic) {
          let domain = '';
          try {
            domain = new URL(item.link).hostname;
          } catch {
            domain = 'google';
          }

          results.push({
            title: item.title || '',
            url: item.link || '',
            snippet: item.snippet || '',
            publishedDate: item.date,
            source: domain,
          });
        }
      }

      return {
        query,
        results,
        latencyMs: Date.now() - startTime,
        provider: 'serper',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
