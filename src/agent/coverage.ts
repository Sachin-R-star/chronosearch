import { CoverageAssessment, SearchQuery, SearchResultItem } from './types.js';
import { WebSearchTool } from '../search/tool.js';

export class EpistemicCoverageAnalyzer {
  /**
   * Evaluates if the fetched search results sufficiently cover all target entities.
   * If any entity is under-represented, executes an adaptive follow-up search hop.
   */
  public async assessAndFillGaps(
    targetEntities: string[],
    currentResults: SearchResultItem[],
    searchTool: WebSearchTool,
    onAdaptiveHop?: (query: string) => void
  ): Promise<{ results: SearchResultItem[]; assessment: CoverageAssessment }> {
    if (targetEntities.length === 0) {
      return {
        results: currentResults,
        assessment: {
          isFullyCovered: true,
          missingEntities: [],
          adaptiveHopsExecuted: 0,
          targetEntities: [],
        },
      };
    }

    const combinedText = currentResults
      .map((r) => `${r.title} ${r.snippet} ${r.url}`)
      .join(' ')
      .toLowerCase();

    const missing: string[] = [];
    for (const entity of targetEntities) {
      if (!combinedText.includes(entity.toLowerCase())) {
        missing.push(entity);
      }
    }

    let adaptiveHops = 0;
    const additionalResults: SearchResultItem[] = [];

    // If an entity is missing, execute a single bounded follow-up hop
    if (missing.length > 0 && missing.length <= 3) {
      const followUpQueries: SearchQuery[] = missing.map((entity) => ({
        query: `${entity} official pricing plans changelog 2026`,
        purpose: 'verification',
        recency: 'month',
      }));

      for (const q of followUpQueries) {
        if (onAdaptiveHop) onAdaptiveHop(q.query);
        adaptiveHops++;
      }

      const toolInputs = followUpQueries.map((q) => ({
        query: q.query,
        options: { recency: q.recency, maxResults: 3 },
      }));

      const newToolResults = await searchTool.executeParallel(toolInputs);
      const deduplicated = searchTool.deduplicateResults(newToolResults);
      additionalResults.push(...deduplicated);
    }

    const merged = searchTool.deduplicateResults([
      { query: 'initial', results: currentResults, latencyMs: 0, provider: 'initial' },
      { query: 'adaptive', results: additionalResults, latencyMs: 0, provider: 'adaptive' },
    ]);

    return {
      results: merged,
      assessment: {
        isFullyCovered: missing.length === 0 || additionalResults.length > 0,
        missingEntities: missing,
        adaptiveHopsExecuted: adaptiveHops,
        targetEntities,
      },
    };
  }
}

export const defaultCoverageAnalyzer = new EpistemicCoverageAnalyzer();
