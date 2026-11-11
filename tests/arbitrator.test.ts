import test from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceArbitrator, ExtractedPriceClaim } from '../src/agent/arbitrator.js';

test('EvidenceArbitrator resolves conflicting claims favoring high authority vendor sources', () => {
  const arbitrator = new EvidenceArbitrator();

  const conflictingClaims: ExtractedPriceClaim[] = [
    {
      entity: 'hubspot',
      tier: 'Starter',
      monthlyPerUser: 50, // Outdated blog claim
      sourceUrl: 'https://outdated-blog.org/hubspot-review',
      sourceDomain: 'outdated-blog.org',
      sourceAuthorityWeight: 0.6,
      rawSnippet: 'HubSpot Starter is $50/mo.',
    },
    {
      entity: 'hubspot',
      tier: 'Starter',
      monthlyPerUser: 20, // Official vendor claim
      sourceUrl: 'https://hubspot.com/pricing',
      sourceDomain: 'hubspot.com',
      sourceAuthorityWeight: 2.0,
      rawSnippet: 'HubSpot Sales Hub Starter begins at $20/seat/month.',
    },
    {
      entity: 'hubspot',
      tier: 'Starter',
      monthlyPerUser: 25, // Confused affiliate site
      sourceUrl: 'https://affiliate-site.com/crm-prices',
      sourceDomain: 'affiliate-site.com',
      sourceAuthorityWeight: 0.9,
      rawSnippet: 'Plans start at $25/seat.',
    },
  ];

  const results = arbitrator.arbitrate(conflictingClaims, [] as any, 20);
  const hubspotResult = results.get('hubspot');

  assert.ok(hubspotResult);
  assert.equal(hubspotResult.resolvedMonthlyPerUser, 20); // Official $20 wins
  assert.equal(hubspotResult.resolvedTeamCost, 400); // 20 users * $20 = $400
  assert.equal(hubspotResult.hasContradiction, true);
  assert.equal(hubspotResult.competingClaimsCount, 3);
  assert.ok(hubspotResult.arbitrationRationale.includes('Official vendor source hubspot.com ($20/user) prioritized'));
});

