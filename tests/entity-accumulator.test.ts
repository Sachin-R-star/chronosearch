import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveEntityAccumulator } from '../src/memory/entity-accumulator.js';
import { ConversationSession } from '../src/agent/types.js';

test('LiveEntityAccumulator accumulates entities and constraints across conversation turns', () => {
  const accumulator = new LiveEntityAccumulator();

  const mockSession: ConversationSession = {
    id: 'test-session-multi-turn',
    title: 'CRM Evaluation',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    entitySnapshots: [],
  };

  // Turn 1
  const turn1 = accumulator.updateSessionGraph(mockSession, 'We need to evaluate CRM tools for our 20-person sales team.');
  assert.equal(turn1.constraints.teamSize, 20);
  assert.equal(turn1.constraints.category, 'crm');

  // Turn 2
  const turn2 = accumulator.updateSessionGraph(mockSession, 'Let us evaluate HubSpot and Pipedrive.');
  assert.deepEqual(turn2.newEntitiesDiscovered, ['HubSpot Sales Hub', 'Pipedrive']);
  assert.equal(turn2.totalEntitiesTracked, 2);

  // Turn 3
  const turn3 = accumulator.updateSessionGraph(mockSession, 'Also include Salesforce, Zoho, and Close CRM.');
  assert.deepEqual(turn3.newEntitiesDiscovered, ['Salesforce Starter Suite', 'Zoho CRM', 'Close CRM']);
  assert.equal(turn3.totalEntitiesTracked, 5);

  const allEntities = accumulator.getTrackedEntities(mockSession);
  assert.equal(allEntities.length, 5);
  assert.ok(allEntities.includes('HubSpot Sales Hub'));
  assert.ok(allEntities.includes('Salesforce Starter Suite'));
});

