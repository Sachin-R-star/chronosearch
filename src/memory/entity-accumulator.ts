import { ConversationSession, EntitySnapshot } from '../agent/types.js';

export interface ExtractedConstraints {
  teamSize?: number;
  category?: 'crm' | 'database' | 'infra' | 'saas' | 'general';
  targetAudience?: string;
  budgetConstraint?: string;
}

export class LiveEntityAccumulator {
  private knownEntities: Record<string, { category: EntitySnapshot['category']; canonicalName: string }> = {
    hubspot: { category: 'crm', canonicalName: 'HubSpot Sales Hub' },
    pipedrive: { category: 'crm', canonicalName: 'Pipedrive' },
    salesforce: { category: 'crm', canonicalName: 'Salesforce Starter Suite' },
    zoho: { category: 'crm', canonicalName: 'Zoho CRM' },
    close: { category: 'crm', canonicalName: 'Close CRM' },
    freshsales: { category: 'crm', canonicalName: 'Freshsales' },
    neon: { category: 'database', canonicalName: 'Neon' },
    supabase: { category: 'database', canonicalName: 'Supabase' },
    railway: { category: 'infra', canonicalName: 'Railway' },
    tembo: { category: 'database', canonicalName: 'Tembo' },
    aurora: { category: 'database', canonicalName: 'AWS Aurora Serverless v2' },
  };

  /**
   * Accumulates entities and structural constraints across conversational turns.
   */
  public updateSessionGraph(session: ConversationSession, currentTurnText: string): {
    newEntitiesDiscovered: string[];
    totalEntitiesTracked: number;
    constraints: ExtractedConstraints;
  } {
    if (!session.entitySnapshots) {
      session.entitySnapshots = [];
    }

    const lower = currentTurnText.toLowerCase();
    const existingNames = new Set(session.entitySnapshots.map((e) => e.name.toLowerCase()));
    const newEntities: string[] = [];

    // 1. Detect and accumulate entities
    for (const [key, info] of Object.entries(this.knownEntities)) {
      if (lower.includes(key)) {
        const canonical = info.canonicalName;
        if (!existingNames.has(canonical.toLowerCase()) && !existingNames.has(key)) {
          existingNames.add(canonical.toLowerCase());
          newEntities.push(canonical);

          session.entitySnapshots.push({
            name: canonical,
            category: info.category,
            baselineDate: new Date().toISOString().split('T')[0],
            attributes: {
              discoveredInTurn: session.messages.length + 1,
              sourceTurnQuery: currentTurnText.slice(0, 100),
            },
          });
        }
      }
    }

    // 2. Extract structural constraints (e.g. 20-person sales team)
    const constraints: ExtractedConstraints = {};

    const teamMatch = lower.match(/\b(\d+)\s*[- ]*(?:person|user|seat|rep|people|member)\b/);
    if (teamMatch) {
      constraints.teamSize = parseInt(teamMatch[1], 10);
    }

    if (lower.includes('sales team') || lower.includes('crm')) {
      constraints.category = 'crm';
      constraints.targetAudience = 'sales team';
    } else if (lower.includes('postgres') || lower.includes('database')) {
      constraints.category = 'database';
    }

    return {
      newEntitiesDiscovered: newEntities,
      totalEntitiesTracked: session.entitySnapshots.length,
      constraints,
    };
  }

  /**
   * Recovers accumulated entities for a given session.
   */
  public getTrackedEntities(session: ConversationSession): string[] {
    return (session.entitySnapshots || []).map((e) => e.name);
  }
}

export const defaultEntityAccumulator = new LiveEntityAccumulator();

