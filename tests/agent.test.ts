import test from 'node:test';
import assert from 'node:assert';
import { ChronoAgent } from '../src/agent/agent.js';
import { TemporalEngine } from '../src/agent/temporal.js';
import { MemoryStore } from '../src/memory/store.js';

test('Agent handles CRM Shortlist Delta prompt', async () => {
  const refDate = new Date(2026, 10, 10, 12, 0, 0); // Tuesday, Nov 10, 2026
  const temporal = new TemporalEngine(refDate);
  const memory = new MemoryStore({ referenceDate: refDate });
  const agent = new ChronoAgent({ temporal, memory });

  const query = 'On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?';
  const response = await agent.chat(query);

  assert.ok(response.content);
  assert.ok(response.metadata);
  assert.ok(response.metadata.temporalAnchor);
  assert.strictEqual(response.metadata.temporalAnchor.anchorDate, '2026-11-09');
  assert.ok(response.content.toLowerCase().includes('crm') || response.content.toLowerCase().includes('hubspot'));
});

test('Agent handles 3 November Recall & Staleness prompt', async () => {
  const refDate = new Date(2026, 10, 10, 12, 0, 0);
  const temporal = new TemporalEngine(refDate);
  const memory = new MemoryStore({ referenceDate: refDate });
  const agent = new ChronoAgent({ temporal, memory });

  const query = 'What did I ask you on 3 November? Is your answer still correct today?';
  const response = await agent.chat(query);

  assert.ok(response.content);
  assert.ok(response.metadata?.temporalAnchor);
  assert.strictEqual(response.metadata.temporalAnchor.anchorDate, '2026-11-03');
  assert.ok(response.content.toLowerCase().includes('postgres') || response.content.toLowerCase().includes('3 november'));
});

test('Agent handles Last Tuesday Postgres Delta prompt', async () => {
  const refDate = new Date(2026, 10, 10, 12, 0, 0);
  const temporal = new TemporalEngine(refDate);
  const memory = new MemoryStore({ referenceDate: refDate });
  const agent = new ChronoAgent({ temporal, memory });

  const query = 'Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?';
  const response = await agent.chat(query);

  assert.ok(response.content);
  assert.ok(response.metadata?.temporalAnchor);
  assert.strictEqual(response.metadata.temporalAnchor.anchorDate, '2026-11-03');
  assert.ok(response.content.toLowerCase().includes('postgres') || response.content.toLowerCase().includes('neon'));
});

