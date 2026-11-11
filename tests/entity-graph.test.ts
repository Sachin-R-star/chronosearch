import test from 'node:test';
import assert from 'node:assert';
import { TemporalEntityGraph } from '../src/agent/entity-graph.js';
import { SearchResultItem } from '../src/agent/types.js';

test('TemporalEntityGraph computes 20-person CRM math and delta', () => {
  const graph = new TemporalEntityGraph();

  const mockSearchResults: SearchResultItem[] = [
    {
      title: 'HubSpot Sales Hub Pricing & Plans',
      url: 'https://hubspot.com/pricing/sales',
      snippet: 'Sales Hub Starter starts at $20/seat/mo. Sales Hub Pro starts at $500/mo.',
      source: 'hubspot.com',
    },
    {
      title: 'Pipedrive Plans and Pricing',
      url: 'https://pipedrive.com/pricing',
      snippet: 'Pipedrive Advanced plan at $27.90 per user per month billed annually.',
      source: 'pipedrive.com',
    },
  ];

  const delta = graph.computeGraphDelta(
    {
      category: 'crm',
      baselineDate: '2026-11-09',
      currentDate: 'Wednesday, November 11, 2026',
      teamSize: 20,
    },
    'shortlisted 5 crm tools for 20-person sales team',
    mockSearchResults
  );

  assert.ok(delta);
  assert.strictEqual(delta.hasChanges, false);
  assert.ok(delta.facts.length >= 5);
  assert.ok(delta.facts.some((f) => f.entity.includes('HubSpot') && f.baselineValue.includes('$400/mo')));
  assert.ok(delta.facts.some((f) => f.entity.includes('Pipedrive') && f.baselineValue.includes('$558/mo')));
  assert.ok(delta.facts.some((f) => f.entity.includes('Salesforce') && f.baselineValue.includes('$500/mo')));
});

test('TemporalEntityGraph computes Postgres hosting stability', () => {
  const graph = new TemporalEntityGraph();

  const mockSearchResults: SearchResultItem[] = [
    {
      title: 'Neon Serverless Postgres Pricing',
      url: 'https://neon.tech/pricing',
      snippet: 'Neon Launch plan at $19/mo. Scale plan at $69/mo. Free tier includes 0.5 GB.',
      source: 'neon.tech',
    },
  ];

  const delta = graph.computeGraphDelta(
    {
      category: 'database',
      baselineDate: '2026-11-03',
      currentDate: 'Wednesday, November 11, 2026',
    },
    'postgres hosting recommendations neon supabase railway',
    mockSearchResults
  );

  assert.ok(delta);
  assert.strictEqual(delta.hasChanges, false);
  assert.ok(delta.verdict.includes('No pricing changes'));
});
