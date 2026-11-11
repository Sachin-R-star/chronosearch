import test from 'node:test';
import assert from 'node:assert';
import { TemporalEngine } from '../src/agent/temporal.js';

test('TemporalEngine resolves explicit dates', () => {
  // Reference date: Tuesday, Nov 10, 2026
  const refDate = new Date(2026, 10, 10, 12, 0, 0);
  const engine = new TemporalEngine(refDate);

  const parsed = engine.parseTemporalExpression('What did I ask you on 3 November?');
  assert.ok(parsed);
  assert.strictEqual(parsed.anchorDate, '2026-11-03');
  assert.strictEqual(parsed.dayOfWeek, 'Tuesday');
  assert.strictEqual(parsed.relativeDays, -7);
});

test('TemporalEngine resolves relative days of week', () => {
  const refDate = new Date(2026, 10, 10, 12, 0, 0); // Tuesday
  const engine = new TemporalEngine(refDate);

  const parsedTuesday = engine.parseTemporalExpression('Last Tuesday I asked about Postgres');
  assert.ok(parsedTuesday);
  assert.strictEqual(parsedTuesday.anchorDate, '2026-11-03');
  assert.strictEqual(parsedTuesday.relativeDays, -7);

  const parsedMonday = engine.parseTemporalExpression('On Monday we shortlisted 5 CRM tools');
  assert.ok(parsedMonday);
  assert.strictEqual(parsedMonday.anchorDate, '2026-11-09');
  assert.strictEqual(parsedMonday.relativeDays, -1);
});

test('TemporalEngine generates calibrated relative frame', () => {
  const refDate = new Date(2026, 10, 10, 12, 0, 0);
  const engine = new TemporalEngine(refDate);
  const frame = engine.getTemporalFrame();

  assert.strictEqual(frame.todayISO, '2026-11-10');
  assert.ok(frame.calendarAnchors['today']);
  assert.ok(frame.calendarAnchors['yesterday']);
  assert.strictEqual(frame.calendarAnchors['yesterday'].iso, '2026-11-09');
  assert.strictEqual(frame.calendarAnchors['last tuesday'].iso, '2026-11-03');
});

