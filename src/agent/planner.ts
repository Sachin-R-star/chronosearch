import { SearchQuery, TemporalAnchor } from './types.js';

export interface PlanResult {
  requiresMemoryRecall: boolean;
  requiresSearch: boolean;
  isDeltaVerification: boolean;
  temporalAnchor: TemporalAnchor | null;
  extractedEntities: string[];
  searchQueries: SearchQuery[];
  intentSummary: string;
}

export class SearchPlanner {
  /**
   * Plans the execution strategy for a given user query and temporal context.
   */
  public plan(query: string, anchor: TemporalAnchor | null, contextText?: string): PlanResult {
    const lower = query.toLowerCase();

    // 1. Detect if query refers to past interactions / memory
    const memoryKeywords = [
      'shortlisted',
      'asked you',
      'we discussed',
      'did i ask',
      'our conversation',
      'you recommended',
      'since then',
      'is your answer',
      'changed since',
      'shipped something big',
    ];
    const hasMemoryKeyword = memoryKeywords.some((kw) => lower.includes(kw));
    const hasTemporalPast = anchor ? anchor.isPastReference : false;
    const requiresMemoryRecall = hasMemoryKeyword || (hasTemporalPast && !lower.startsWith('search for'));

    // 2. Detect Delta / Verification intent
    const deltaKeywords = [
      'changed pricing',
      'any of them changed',
      'shipped something',
      'is your answer still correct',
      'still correct today',
      'has any pricing changed',
      'any updates',
      'what changed',
      'since then',
    ];
    const isDeltaVerification = deltaKeywords.some((kw) => lower.includes(kw));

    // 3. Extract entities (from query + optional recalled context)
    const combinedText = `${query} ${contextText || ''}`.toLowerCase();
    const entities: string[] = [];

    // Common CRM entities
    const knownCrms = ['hubspot', 'pipedrive', 'salesforce', 'zoho', 'close', 'freshsales', 'copper', 'monday crm'];
    for (const crm of knownCrms) {
      if (combinedText.includes(crm)) {
        entities.push(crm.charAt(0).toUpperCase() + crm.slice(1));
      }
    }

    // Common Postgres entities
    const knownPostgres = ['neon', 'supabase', 'railway', 'tembo', 'aurora', 'render', 'crunchy data'];
    for (const pg of knownPostgres) {
      if (combinedText.includes(pg)) {
        entities.push(pg.charAt(0).toUpperCase() + pg.slice(1));
      }
    }

    // 4. Generate search queries
    const searchQueries: SearchQuery[] = [];
    const requiresSearch = !this.isPureConversational(lower);

    if (requiresSearch) {
      if (isDeltaVerification) {
        // Delta search: issue targeted pricing and changelog queries
        if (combinedText.includes('crm')) {
          searchQueries.push({
            query: 'HubSpot Pipedrive Salesforce Zoho CRM pricing update 2026',
            purpose: 'pricing',
            recency: 'month',
          });
          searchQueries.push({
            query: 'HubSpot Pipedrive Salesforce CRM changelog new features 2026',
            purpose: 'changelog',
            recency: 'month',
          });
          searchQueries.push({
            query: 'Close CRM pricing updates 2026',
            purpose: 'pricing',
            recency: 'month',
          });
        } else if (combinedText.includes('postgres') || combinedText.includes('hosting')) {
          searchQueries.push({
            query: 'Neon Supabase Postgres pricing changes updates 2026',
            purpose: 'pricing',
            recency: 'month',
          });
          searchQueries.push({
            query: 'Railway Tembo Postgres pricing changes 2026',
            purpose: 'pricing',
            recency: 'month',
          });
          searchQueries.push({
            query: 'Neon Supabase changelog major releases November 2026',
            purpose: 'changelog',
            recency: 'month',
          });
        } else if (entities.length > 0) {
          // Specific entity diff queries
          const entityGroup = entities.slice(0, 3).join(' ');
          searchQueries.push({
            query: `${entityGroup} pricing changes updates 2026`,
            purpose: 'pricing',
            recency: 'month',
          });
          searchQueries.push({
            query: `${entityGroup} changelog release notes 2026`,
            purpose: 'changelog',
            recency: 'month',
          });
        } else {
          // Fallback delta query
          searchQueries.push({
            query: `${query.replace(/what did i ask you on|last tuesday|monday|since then/gi, '').trim()} updates pricing 2026`,
            purpose: 'verification',
            recency: 'month',
          });
        }
      } else {
        // Standard fresh search query
        const cleanQuery = query.replace(/[^\w\s-]/g, ' ').trim();
        searchQueries.push({
          query: cleanQuery,
          purpose: 'general',
          recency: 'month',
        });
      }
    }

    let intentSummary = 'General Search';
    if (requiresMemoryRecall && isDeltaVerification) {
      intentSummary = 'Episodic Memory Recall & Delta Verification';
    } else if (requiresMemoryRecall) {
      intentSummary = 'Episodic Memory Recall';
    } else if (isDeltaVerification) {
      intentSummary = 'Live Delta / Staleness Verification';
    }

    return {
      requiresMemoryRecall,
      requiresSearch,
      isDeltaVerification,
      temporalAnchor: anchor,
      extractedEntities: entities,
      searchQueries,
      intentSummary,
    };
  }

  private isPureConversational(text: string): boolean {
    const pure = [
      'hi',
      'hello',
      'hey',
      'how are you',
      'who are you',
      'what can you do',
      'thanks',
      'thank you',
      'bye',
      'goodbye',
    ];
    const trimmed = text.trim().toLowerCase().replace(/[!?.]/g, '');
    return pure.includes(trimmed);
  }
}

export const defaultPlanner = new SearchPlanner();
