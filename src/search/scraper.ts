import * as cheerio from 'cheerio';

export interface ScrapedPage {
  url: string;
  title: string;
  text: string;
  success: boolean;
}

export class PageScraper {
  private timeoutMs: number;

  constructor(timeoutMs: number = 2000) {
    this.timeoutMs = timeoutMs;
  }

  public async scrapeUrl(url: string): Promise<ScrapedPage> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        return { url, title: '', text: '', success: false };
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      // Strip non-content elements
      $('script, style, noscript, nav, header, footer, svg, iframe, .cookie-banner, .advertisement').remove();

      const title = $('title').text().trim() || $('h1').first().text().trim();

      // Extract main content or body text
      let text = $('main, article, [role="main"]').text().trim();
      if (!text || text.length < 100) {
        text = $('body').text().trim();
      }

      // Normalize whitespace
      const cleanText = text.replace(/\s+/g, ' ').slice(0, 3000); // Keep top 3k chars for fast LLM ingestion

      return {
        url,
        title,
        text: cleanText,
        success: cleanText.length > 50,
      };
    } catch {
      return { url, title: '', text: '', success: false };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Scrapes multiple URLs in parallel with strict timeout.
   */
  public async scrapeMultiple(urls: string[]): Promise<Record<string, ScrapedPage>> {
    const results: Record<string, ScrapedPage> = {};
    const promises = urls.slice(0, 3).map(async (url) => {
      try {
        const scraped = await this.scrapeUrl(url);
        if (scraped.success) {
          results[url] = scraped;
        }
      } catch {
        // ignore errors
      }
    });

    await Promise.allSettled(promises);
    return results;
  }
}

export const defaultScraper = new PageScraper();
