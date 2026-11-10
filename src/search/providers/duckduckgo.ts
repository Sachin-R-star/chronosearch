import * as cheerio from 'cheerio';
import { SearchProvider, WebSearchOptions } from '../types.js';
import { SearchResultItem, SearchToolResult } from '../../agent/types.js';

export class DuckDuckGoSearchProvider implements SearchProvider {
  public name = 'duckduckgo';

  public isAvailable(): boolean {
    return true; // Always available as zero-config fallback
  }

  public async search(query: string, options: WebSearchOptions = {}): Promise<SearchToolResult> {
    const startTime = Date.now();
    const maxResults = options.maxResults || 5;

    // Apply domain filtering to query string if provided
    let effectiveQuery = query;
    if (options.domains && options.domains.length > 0) {
      const domainFilter = options.domains.map((d) => `site:${d}`).join(' OR ');
      effectiveQuery = `(${domainFilter}) ${query}`;
    }

    try {
      const results = await this.fetchHtmlSearch(effectiveQuery, maxResults);
      if (results.length > 0) {
        return {
          query,
          results,
          latencyMs: Date.now() - startTime,
          provider: 'duckduckgo-html',
        };
      }
    } catch (err) {
      console.warn('DuckDuckGo HTML search failed, attempting API fallback:', err);
    }

    // Secondary fallback: DuckDuckGo Instant Answer API
    try {
      const apiResults = await this.fetchApiSearch(effectiveQuery, maxResults);
      return {
        query,
        results: apiResults,
        latencyMs: Date.now() - startTime,
        provider: 'duckduckgo-api',
      };
    } catch (apiErr) {
      console.warn('DuckDuckGo API search failed:', apiErr);
      return {
        query,
        results: [],
        latencyMs: Date.now() - startTime,
        provider: 'duckduckgo-none',
      };
    }
  }

  private async fetchHtmlSearch(query: string, limit: number): Promise<SearchResultItem[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const bodyParams = new URLSearchParams({ q: query, b: '' });
      const response = await fetch('https://html.duckduckgo.com/html/', {
        method: 'POST',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        body: bodyParams.toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo returned HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const items: SearchResultItem[] = [];

      $('.result').each((_, el) => {
        if (items.length >= limit) return;

        const titleEl = $(el).find('.result__title a');
        const snippetEl = $(el).find('.result__snippet');
        const rawHref = titleEl.attr('href') || '';
        const title = titleEl.text().trim();
        const snippet = snippetEl.text().trim();

        if (!title || !rawHref) return;

        // Resolve DDG redirect URL: /l/?kh=-1&uddg=https%3A%2F%2F...
        let cleanUrl = rawHref;
        if (rawHref.includes('uddg=')) {
          try {
            const parsed = new URL(`https://duckduckgo.com${rawHref}`);
            const uddg = parsed.searchParams.get('uddg');
            if (uddg) cleanUrl = decodeURIComponent(uddg);
          } catch {
            // keep rawHref if parsing fails
          }
        }

        let domain = '';
        try {
          domain = new URL(cleanUrl).hostname;
        } catch {
          domain = 'web';
        }

        items.push({
          title,
          url: cleanUrl,
          snippet,
          source: domain,
        });
      });

      return items;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchApiSearch(query: string, limit: number): Promise<SearchResultItem[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'ChronoSearchAgent/1.0',
        },
        signal: controller.signal,
      });

      if (!res.ok) return [];

      const data = (await res.json()) as any;
      const items: SearchResultItem[] = [];

      if (data.AbstractText && data.AbstractURL) {
        items.push({
          title: data.Heading || query,
          url: data.AbstractURL,
          snippet: data.AbstractText,
          source: data.AbstractSource || 'duckduckgo',
        });
      }

      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          if (items.length >= limit) break;
          if (topic.Text && topic.FirstURL) {
            items.push({
              title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 40),
              url: topic.FirstURL,
              snippet: topic.Text,
              source: 'duckduckgo',
            });
          }
        }
      }

      return items;
    } finally {
      clearTimeout(timeout);
    }
  }
}
