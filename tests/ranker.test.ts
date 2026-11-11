import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceReliabilityRanker } from '../src/search/ranker.js';
import { SearchResultItem } from '../src/agent/types.js';

test('SourceReliabilityRanker weights official vendors higher than aggregators and blogs', () => {
  const ranker = new SourceReliabilityRanker();

  const mockItems: SearchResultItem[] = [
    {
      title: 'Top 10 CRM Alternatives and Honest Reviews 2023',
      url: 'https://random-tech-blog.org/crm-review',
      snippet: 'We look at top 10 CRM alternatives for small teams.',
      source: 'random-tech-blog.org',
    },
    {
      title: 'HubSpot Sales Hub Official Pricing & Packaging',
      url: 'https://www.hubspot.com/pricing/sales',
      snippet: 'HubSpot Sales Hub Starter starts at $20/seat/month. Pro is $500/mo base for 5 users + $100/mo per user.',
      source: 'hubspot.com',
      publishedDate: '2026-11-01',
    },
    {
      title: 'HubSpot Reviews 2024 - User Ratings & Pricing',
      url: 'https://www.g2.com/products/hubspot-sales-hub/reviews',
      snippet: 'User reviews and pricing information on G2 crowd.',
      source: 'g2.com',
    },
  ];

  const ranked = ranker.rankResults(mockItems, '2026-11-11');

  // Official vendor must be ranked #1
  assert.equal(ranked[0].source, 'hubspot.com');
  assert.equal(ranked[0].domainTier, 'OFFICIAL_VENDOR');
  assert.ok(ranked[0].compositeReliabilityScore > ranked[1].compositeReliabilityScore);

  // Aggregator is ranked above generic clickbait blog
  assert.equal(ranked[1].source, 'g2.com');
  assert.equal(ranked[1].domainTier, 'AGGREGATOR');

  assert.equal(ranked[2].source, 'random-tech-blog.org');
  assert.equal(ranked[2].domainTier, 'GENERIC_WEB');
});

test('SourceReliabilityRanker applies temporal decay to outdated content', () => {
  const ranker = new SourceReliabilityRanker();

  const recentItem: SearchResultItem = {
    title: 'Neon Serverless Postgres Pricing Updates',
    url: 'https://neon.tech/pricing',
    snippet: 'Launch plan is $19/mo, Scale plan is $69/mo.',
    source: 'neon.tech',
    publishedDate: '2026-11-05',
  };

  const oldItem: SearchResultItem = {
    title: 'Neon Postgres Launch Announcement from 2023',
    url: 'https://neon.tech/blog/old-launch',
    snippet: 'Old beta pricing from 2 years ago.',
    source: 'neon.tech',
    publishedDate: '2023-01-15',
  };

  const ranked = ranker.rankResults([oldItem, recentItem], '2026-11-11');
  assert.equal(ranked[0].title, 'Neon Serverless Postgres Pricing Updates');
  assert.ok(ranked[0].temporalDecayScore > ranked[1].temporalDecayScore);
});
