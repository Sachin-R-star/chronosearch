import { Citation } from './types.js';

export interface SanitizationResult {
  sanitizedText: string;
  repairedCitationsCount: number;
  invalidCitationsRemoved: number;
  validCitationIndices: number[];
}

/**
 * Citation Guardrail & Referential Integrity Verifier
 *
 * Ensures that every citation index [^N] rendered in assistant output
 * corresponds to an actual, verified document in the citations list.
 *
 * If a model hallucinates an out-of-bounds citation (e.g. [^8] when only 6 citations exist),
 * the sanitizer intercepts and repairs it by remapping to the closest document or removing it.
 */
export class CitationSanitizer {
  public sanitize(
    rawText: string,
    citations: Citation[]
  ): SanitizationResult {
    const maxIndex = citations.length;
    const validIndexSet = new Set(citations.map((c) => c.index));

    let repairedCitationsCount = 0;
    let invalidCitationsRemoved = 0;

    const sanitizedText = rawText.replace(/\[\^?(\d+)\]/g, (match, p1) => {
      const idx = parseInt(p1, 10);
      if (validIndexSet.has(idx)) {
        return `[^${idx}]`;
      }

      // Out of bounds citation repair
      if (idx > maxIndex && maxIndex > 0) {
        repairedCitationsCount++;
        // Remap to nearest available citation (or clamp to maxIndex)
        return `[^${maxIndex}]`;
      }

      invalidCitationsRemoved++;
      return '';
    });

    return {
      sanitizedText,
      repairedCitationsCount,
      invalidCitationsRemoved,
      validCitationIndices: Array.from(validIndexSet),
    };
  }
}

export const defaultCitationSanitizer = new CitationSanitizer();
