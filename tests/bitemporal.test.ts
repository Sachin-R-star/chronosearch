import test from 'node:test';
import assert from 'node:assert/strict';
import { BitemporalOperator, BitemporalFact } from '../src/agent/bitemporal.js';

test('BitemporalOperator computes pricing stability and unit economics', () => {
  const operator = new BitemporalOperator();

  const baselineFacts: BitemporalFact[] = [
    {
      entityId: 'hubspot',
      name: 'HubSpot Sales Hub',
      validTime: { start: '2026-11-09' },
      transactionTime: { recordedAt: '2026-11-09T10:15:00Z' },
      attributes: {
        tierName: 'Starter',
        unitPriceMonthly: 20,
        teamCostMonthly: 400,
        teamSize: 20,
        features: ['sequences', 'templates', 'Breeze AI'],
        sourceUrl: 'https://hubspot.com/pricing',
      },
    },
    {
      entityId: 'pipedrive',
      name: 'Pipedrive',
      validTime: { start: '2026-11-09' },
      transactionTime: { recordedAt: '2026-11-09T10:15:00Z' },
      attributes: {
        tierName: 'Advanced',
        unitPriceMonthly: 27.90,
        teamCostMonthly: 558,
        teamSize: 20,
        features: ['visual pipeline', 'email sync'],
        sourceUrl: 'https://pipedrive.com/pricing',
      },
    },
  ];

  const currentFacts: BitemporalFact[] = [
    {
      entityId: 'hubspot',
      name: 'HubSpot Sales Hub',
      validTime: { start: '2026-11-11' },
      transactionTime: { recordedAt: '2026-11-11T12:00:00Z' },
      attributes: {
        tierName: 'Starter',
        unitPriceMonthly: 20,
        teamCostMonthly: 400,
        teamSize: 20,
        features: ['sequences', 'templates', 'Breeze AI', 'Breeze prospecting copilot'],
        sourceUrl: 'https://hubspot.com/pricing',
      },
    },
    {
      entityId: 'pipedrive',
      name: 'Pipedrive',
      validTime: { start: '2026-11-11' },
      transactionTime: { recordedAt: '2026-11-11T12:00:00Z' },
      attributes: {
        tierName: 'Advanced',
        unitPriceMonthly: 27.90,
        teamCostMonthly: 558,
        teamSize: 20,
        features: ['visual pipeline', 'email sync'],
        sourceUrl: 'https://pipedrive.com/pricing',
      },
    },
  ];

  const summary = operator.computeDelta(baselineFacts, currentFacts, 20);

  assert.equal(summary.entityCount, 2);
  assert.equal(summary.entitiesWithPricingChanges, 0);
  assert.equal(summary.entitiesWithShippedFeatures, 1); // HubSpot Breeze prospecting copilot

  const hubspotDelta = summary.deltaResults.find((d) => d.entityId === 'hubspot');
  assert.ok(hubspotDelta);
  assert.equal(hubspotDelta.pricingDelta.isUnchanged, true);
  assert.equal(hubspotDelta.pricingDelta.currentTeamCost, 400);
  assert.equal(hubspotDelta.status, 'FEATURE_SHIPPED');
  assert.deepEqual(hubspotDelta.featureDelta.shippedFeatures, ['Breeze prospecting copilot']);

  const pipedriveDelta = summary.deltaResults.find((d) => d.entityId === 'pipedrive');
  assert.ok(pipedriveDelta);
  assert.equal(pipedriveDelta.status, 'UNCHANGED');
  assert.equal(pipedriveDelta.pricingDelta.currentTeamCost, 558);
});
