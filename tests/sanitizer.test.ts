import test from 'node:test';
import assert from 'node:assert/strict';
import { CitationSanitizer } from '../src/agent/sanitizer.js';
import { Citation } from '../src/agent/types.js';

test('CitationSanitizer repairs hallucinated out-of-bounds citations', () => {
  const sanitizer = new CitationSanitizer();

  const mockCitations: Citation[] = [
    { index: 1, url: 'https://hubspot.com/pricing', title: 'HubSpot', domain: 'hubspot.com' },
    { index: 2, url: 'https://pipedrive.com/pricing', title: 'Pipedrive', domain: 'pipedrive.com' },
  ];

  const rawAssistantText = 'HubSpot pricing remains $400/mo [^1]. Pipedrive is $558/mo [^2]. Hallucinated citation [^99].';

  const result = sanitizer.sanitize(rawAssistantText, mockCitations);

  assert.equal(result.repairedCitationsCount, 1);
  // [^99] was remapped to the maximum valid index [^2]
  assert.ok(result.sanitizedText.includes('[^2]'));
  assert.ok(!result.sanitizedText.includes('[^99]'));
});
