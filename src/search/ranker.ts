import { SearchResultItem } from '../agent/types.js';

export interface ScoredSearchResult extends SearchResultItem {
  domainTier: 'OFFICIAL_VENDOR' | 'TECH_DOCS_MEDIA' | 'AGGREGATOR' | 'GENERIC_WEB';
  domainAuthorityWeight: number;
  temporalDecayScore: number;
  informationDensityScore: number;
  compositeReliabilityScore: number;
}

export class SourceReliabilityRanker {
  private officialVendorDomains = new Set([
    'hubspot.com',
    'pipedrive.com',
    'salesforce.com',
    'zoho.com',
    'close.com',
    'neon.tech',
    'supabase.com',
    'railway.app',
    'tembo.io',
    'aws.amazon.com',
    'amazon.com',
    'postgresql.org',
  ]);

  private authoritativeMediaDomains = new Set([
    'github.com',
    'techcrunch.com',
    'news.ycombinator.com',
    'venturebeat.com',
    'theverge.com',
    'zdnet.com',
    'infoworld.com',
    'prisma.io',
  ]);

  private aggregatorDomains = new Set([
    'g2.com',
    'capterra.com',
    'trustradius.com',
    'softwareadvice.com',
    'getapp.com',
    'sourceforge.net',
  ]);

  /**
   * Ranks search results using an information-theoretic authority and temporal decay model.
   * Composite Score = DomainWeight * TemporalDecay * InformationDensity
   */
  public rankResults(
    results: SearchResultItem[],
    targetDateISO?: string
  ): ScoredSearchResult[] {
    const targetDate = targetDateISO ? new Date(targetDateISO) : new Date();

    return results
      .map((item) => {
        const domain = this.extractDomain(item.url || item.source);
        const { tier, weight } = this.classifyDomain(domain);
        const temporalDecay = this.calculateTemporalDecay(item, targetDate);
        const infoDensity = this.calculateInformationDensity(item);

        const compositeScore = Number(
          (weight * temporalDecay * infoDensity).toFixed(4)
        );

        return {
          ...item,
          domainTier: tier,
          domainAuthorityWeight: weight,
          temporalDecayScore: temporalDecay,
          informationDensityScore: infoDensity,
          compositeReliabilityScore: compositeScore,
        };
      })
      .sort((a, b) => b.compositeReliabilityScore - a.compositeReliabilityScore);
  }

  private extractDomain(urlOrHost: string): string {
    try {
      if (!urlOrHost.startsWith('http://') && !urlOrHost.startsWith('https://')) {
        urlOrHost = 'https://' + urlOrHost;
      }
      const parsed = new URL(urlOrHost);
      return parsed.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return urlOrHost.toLowerCase().replace(/^www\./, '');
    }
  }

  private classifyDomain(domain: string): {
    tier: ScoredSearchResult['domainTier'];
    weight: number;
  } {
    // Check official vendor
    for (const vendor of this.officialVendorDomains) {
      if (domain === vendor || domain.endsWith('.' + vendor)) {
        return { tier: 'OFFICIAL_VENDOR', weight: 2.0 };
      }
    }

    // Check media / tech docs
    for (const media of this.authoritativeMediaDomains) {
      if (domain === media || domain.endsWith('.' + media)) {
        return { tier: 'TECH_DOCS_MEDIA', weight: 1.4 };
      }
    }

    // Check aggregators
    for (const agg of this.aggregatorDomains) {
      if (domain === agg || domain.endsWith('.' + agg)) {
        return { tier: 'AGGREGATOR', weight: 0.9 };
      }
    }

    return { tier: 'GENERIC_WEB', weight: 0.6 };
  }

  /**
   * Exponential decay based on distance from target verification date.
   * S_temporal = exp(-lambda * deltaDays)
   */
  private calculateTemporalDecay(item: SearchResultItem, targetDate: Date): number {
    let itemDate: Date | null = null;

    if (item.publishedDate) {
      const parsed = new Date(item.publishedDate);
      if (!isNaN(parsed.getTime())) {
        itemDate = parsed;
      }
    }

    // Attempt regex extraction from title or snippet if no explicit date
    if (!itemDate) {
      const text = `${item.title} ${item.snippet}`;
      const dateMatch = text.match(/\b(202[4-6])[/-](0[1-9]|1[0-2])[/-](0[1-9]|[12]\d|3[01])\b/);
      if (dateMatch) {
        itemDate = new Date(dateMatch[0]);
      } else if (text.toLowerCase().includes('2026') || text.toLowerCase().includes('november 2026')) {
        itemDate = new Date('2026-11-01');
      }
    }

    if (!itemDate) {
      // Default neutral recency score when date is unspecified
      return 0.85;
    }

    const diffDays = Math.abs(targetDate.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24);

    // Half-life of 90 days for pricing and changelog relevancy
    const lambda = 0.0077; // ln(2) / 90
    const decay = Math.exp(-lambda * diffDays);
    return Math.max(0.4, Number(decay.toFixed(3)));
  }

  /**
   * Evaluates text for concrete facts: pricing symbols, numbers, version patterns, release verbs.
   */
  private calculateInformationDensity(item: SearchResultItem): number {
    const text = `${item.title} ${item.snippet} ${item.pageContent || ''}`.toLowerCase();
    let score = 1.0;

    // Currency and pricing signals
    if (/\$|usd|€|£|per user|per month|\/mo|\/user/.test(text)) {
      score += 0.35;
    }

    // Release and changelog signals
    if (/changelog|release notes|what's new|shipped|announced|update|pricing/.test(text)) {
      score += 0.25;
    }

    // Negative weight for generic search clickbait
    if (/top 10|best alternatives|honest review|vs comparison 2023/.test(text)) {
      score -= 0.15;
    }

    return Math.max(0.5, Math.min(1.8, Number(score.toFixed(3))));
  }
}

export const defaultRanker = new SourceReliabilityRanker();
