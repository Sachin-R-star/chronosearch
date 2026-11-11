import * as cheerio from 'cheerio';

export interface ScrapedPage {
  url: string;
  title: string;
  text: string;
  tables: string[];
  recentDates: string[];
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
        return { url, title: '', text: '', tables: [], recentDates: [], success: false };
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      // Extract publication dates
      const recentDates: string[] = [];
      $('time, [datetime], meta[property*="time"], meta[name*="date"]').each((_, el) => {
        const dt = $(el).attr('datetime') || $(el).attr('content') || $(el).text().trim();
        if (dt && dt.length >= 8 && dt.length <= 30) {
          recentDates.push(dt);
        }
      });

      // Extract structured pricing tables or comparison grids
      const tables: string[] = [];
      $('table, [role="table"], [class*="pricing-table"], [class*="pricing-grid"]').each((_, el) => {
        if (tables.length >= 2) return;
        const rows: string[] = [];
        $(el).find('tr, [role="row"]').each((_, row) => {
          const cells = $(row).find('th, td, [role="cell"]').map((_, cell) => $(cell).text().trim().replace(/\s+/g, ' ')).get();
          if (cells.length > 0) {
            rows.push(cells.join(' | '));
          }
        });
        if (rows.length > 1) {
          tables.push(rows.slice(0, 8).join('\n'));
        }
      });

      // Strip non-content elements
      $('script, style, noscript, nav, header, footer, svg, iframe, .cookie-banner, .advertisement').remove();

      const title = $('title').text().trim() || $('h1').first().text().trim();

      // Extract main text
      let text = $('main, article, [role="main"]').text().trim();
      if (!text || text.length < 100) {
        text = $('body').text().trim();
      }

      const cleanText = text.replace(/\s+/g, ' ').slice(0, 3000);

      return {
        url,
        title,
        text: cleanText,
        tables,
        recentDates: recentDates.slice(0, 3),
        success: cleanText.length > 50,
      };
    } catch {
      return { url, title: '', text: '', tables: [], recentDates: [], success: false };
    } finally {
      clearTimeout(timeout);
    }
  }

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
