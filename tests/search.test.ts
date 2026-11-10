import test from 'node:test';
import assert from 'node:assert';
import { WebSearchTool } from '../src/search/tool.js';

test('WebSearchTool deduplicates results across queries', () => {
  const tool = new WebSearchTool();

  const mockToolResults = [
    {
      query: 'HubSpot pricing 2026',
      latencyMs: 120,
      provider: 'mock',
      results: [
        { title: 'HubSpot Pricing', url: 'https://hubspot.com/pricing', snippet: 'Plans and tiers', source: 'hubspot.com' },
        { title: 'Pipedrive Pricing', url: 'https://pipedrive.com/pricing', snippet: 'Sales CRM', source: 'pipedrive.com' },
      ],
    },
    {
      query: 'HubSpot changelog 2026',
      latencyMs: 110,
      provider: 'mock',
      results: [
        { title: 'HubSpot Pricing Duplicate', url: 'https://hubspot.com/pricing/', snippet: 'Plans and tiers duplicate', source: 'hubspot.com' },
        { title: 'HubSpot What Is New', url: 'https://hubspot.com/new', snippet: 'Recent releases', source: 'hubspot.com' },
      ],
    },
  ];

  const deduplicated = tool.deduplicateResults(mockToolResults);
  assert.strictEqual(deduplicated.length, 3);
  assert.strictEqual(deduplicated[0].url, 'https://hubspot.com/pricing');
  assert.strictEqual(deduplicated[1].url, 'https://pipedrive.com/pricing');
  assert.strictEqual(deduplicated[2].url, 'https://hubspot.com/new');
});
