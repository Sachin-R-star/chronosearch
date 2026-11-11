import test from 'node:test';
import assert from 'node:assert';
import { CitationGroundingVerifier } from '../src/agent/grounding.js';
import { Citation, SearchResultItem } from '../src/agent/types.js';

test('CitationGroundingVerifier validates cited claims against sources', () => {
  const verifier = new CitationGroundingVerifier();

  const citations: Citation[] = [
    {
      index: 1,
      title: 'HubSpot Pricing',
      url: 'https://hubspot.com/pricing',
      domain: 'hubspot.com',
      snippet: 'HubSpot Sales Hub Starter is $20 per seat per month.',
    },
    {
      index: 2,
      title: 'Pipedrive Pricing',
      url: 'https://pipedrive.com/pricing',
      domain: 'pipedrive.com',
      snippet: 'Pipedrive Advanced plan is $27.90 per user monthly.',
    },
  ];

  const sources: SearchResultItem[] = citations.map((c) => ({
    title: c.title,
    url: c.url,
    snippet: c.snippet!,
    source: c.domain,
  }));

  const text = 'HubSpot Sales Hub Starter remains $20 per seat per month [^1]. Pipedrive Advanced is $27.90 per user [^2].';
  const result = verifier.verify(text, sources, citations);

  assert.ok(result);
  assert.ok(result.groundingScore >= 80);
  assert.strictEqual(result.totalClaimsChecked, 2);
  assert.strictEqual(result.verifiedCitations.length, 2);
});
