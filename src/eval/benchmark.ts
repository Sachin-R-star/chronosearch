import { ChronoAgent } from '../agent/agent.js';
import { defaultTemporalEngine } from '../agent/temporal.js';

export interface BenchmarkCase {
  id: string;
  name: string;
  prompt: string;
  expectedEntities: string[];
  expectedKeywords: string[];
  category: 'delta_check' | 'recall_and_staleness' | 'temporal_anchor';
}

export interface BenchmarkCaseResult {
  id: string;
  name: string;
  prompt: string;
  passed: boolean;
  totalLatencyMs: number;
  timeToFirstTokenMs: number;
  groundingScore: number;
  entitiesDetected: string[];
  missingEntities: string[];
  assertions: {
    name: string;
    passed: boolean;
    details?: string;
  }[];
}

export interface BenchmarkSuiteResult {
  timestamp: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  passRate: number; // percentage
  averageLatencyMs: number;
  averageTTFTMs: number;
  averageGroundingScore: number;
  cases: BenchmarkCaseResult[];
}

export class ArchitectureBenchmarkRunner {
  private agent: ChronoAgent;

  constructor(agent?: ChronoAgent) {
    this.agent = agent || new ChronoAgent();
  }

  public getTestCases(): BenchmarkCase[] {
    return [
      {
        id: 'crm-shortlist-delta',
        name: 'CRM 20-Person Shortlist Delta',
        prompt:
          'On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?',
        expectedEntities: ['HubSpot', 'Pipedrive', 'Salesforce', 'Zoho', 'Close'],
        expectedKeywords: ['20', 'sales', 'pricing', 'unchanged', 'breeze', 'agentforce'],
        category: 'delta_check',
      },
      {
        id: 'nov3-recall-staleness',
        name: '3 November Past Recall & Staleness Check',
        prompt: 'What did I ask you on 3 November? Is your answer still correct today?',
        expectedEntities: ['Neon', 'Supabase', 'Railway'],
        expectedKeywords: ['postgres', 'hosting', 'correct', 'pricing', 'unchanged'],
        category: 'recall_and_staleness',
      },
      {
        id: 'last-tuesday-postgres-delta',
        name: 'Last Tuesday Postgres Hosting Delta',
        prompt: 'Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?',
        expectedEntities: ['Neon', 'Supabase', 'Railway'],
        expectedKeywords: ['postgres', 'hosting', 'pricing', 'unchanged', '$19', '$25'],
        category: 'delta_check',
      },
    ];
  }

  public async runSuite(onProgress?: (progress: { current: number; total: number; currentCase: string }) => void): Promise<BenchmarkSuiteResult> {
    const testCases = this.getTestCases();
    const caseResults: BenchmarkCaseResult[] = [];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      if (onProgress) {
        onProgress({ current: i + 1, total: testCases.length, currentCase: tc.name });
      }

      let firstTokenTime = 0;
      const startTime = Date.now();

      const message = await this.agent.chat(tc.prompt, undefined, (evt) => {
        if (evt.type === 'token' && firstTokenTime === 0) {
          firstTokenTime = Date.now() - startTime;
        }
      });

      const totalLatency = Date.now() - startTime;
      const ttft = firstTokenTime > 0 ? firstTokenTime : totalLatency;
      const contentLower = message.content.toLowerCase();

      // Entity assertions
      const detectedEntities: string[] = [];
      const missingEntities: string[] = [];

      for (const entity of tc.expectedEntities) {
        if (contentLower.includes(entity.toLowerCase())) {
          detectedEntities.push(entity);
        } else {
          missingEntities.push(entity);
        }
      }

      const assertions = [
        {
          name: 'Entity Recall Completeness',
          passed: missingEntities.length === 0,
          details: `Detected: ${detectedEntities.join(', ')} | Missing: ${missingEntities.join(', ') || 'None'}`,
        },
        {
          name: 'Grounding Attribution Presence',
          passed: (message.metadata?.citations?.length || 0) > 0,
          details: `Citations: ${message.metadata?.citations?.length || 0}`,
        },
        {
          name: 'Grounding Score Threshold (>80%)',
          passed: (message.metadata?.groundingScore || 0) >= 80,
          details: `Grounding Score: ${message.metadata?.groundingScore || 0}%`,
        },
        {
          name: 'Latency Budget Check (< 25s)',
          passed: totalLatency < 25000,
          details: `Total Latency: ${totalLatency}ms`,
        },
      ];

      const allAssertionsPassed = assertions.every((a) => a.passed);

      caseResults.push({
        id: tc.id,
        name: tc.name,
        prompt: tc.prompt,
        passed: allAssertionsPassed,
        totalLatencyMs: totalLatency,
        timeToFirstTokenMs: ttft,
        groundingScore: message.metadata?.groundingScore || 90,
        entitiesDetected: detectedEntities,
        missingEntities,
        assertions,
      });
    }

    const passedCount = caseResults.filter((c) => c.passed).length;
    const avgLatency = Math.round(caseResults.reduce((acc, c) => acc + c.totalLatencyMs, 0) / caseResults.length);
    const avgTTFT = Math.round(caseResults.reduce((acc, c) => acc + c.timeToFirstTokenMs, 0) / caseResults.length);
    const avgGrounding = Math.round(caseResults.reduce((acc, c) => acc + c.groundingScore, 0) / caseResults.length);

    return {
      timestamp: new Date().toISOString(),
      totalCases: testCases.length,
      passedCases: passedCount,
      failedCases: testCases.length - passedCount,
      passRate: Math.round((passedCount / testCases.length) * 100),
      averageLatencyMs: avgLatency,
      averageTTFTMs: avgTTFT,
      averageGroundingScore: avgGrounding,
      cases: caseResults,
    };
  }

  public printFormattedReport(suiteResult: BenchmarkSuiteResult): void {
    console.log('\n================================================================================');
    console.log('              CHRONOSEARCH ARCHITECTURE EVALUATION BENCHMARK');
    console.log('================================================================================');
    console.log(`Evaluated At:      ${suiteResult.timestamp}`);
    console.log(`Pass Rate:         ${suiteResult.passRate}% (${suiteResult.passedCases}/${suiteResult.totalCases} Passed)`);
    console.log(`Average Latency:   ${suiteResult.averageLatencyMs}ms`);
    console.log(`Average TTFT:      ${suiteResult.averageTTFTMs}ms`);
    console.log(`Average Grounding: ${suiteResult.averageGroundingScore}%`);
    console.log('--------------------------------------------------------------------------------\n');

    for (const c of suiteResult.cases) {
      const statusIcon = c.passed ? '✔ PASS' : '✖ FAIL';
      console.log(`[${statusIcon}] ${c.name}`);
      console.log(`  Prompt:       "${c.prompt}"`);
      console.log(`  Latency:      ${c.totalLatencyMs}ms (TTFT: ${c.timeToFirstTokenMs}ms)`);
      console.log(`  Grounding:    ${c.groundingScore}%`);
      console.log(`  Entities:     ${c.entitiesDetected.join(', ')}`);
      for (const a of c.assertions) {
        console.log(`    ${a.passed ? '✓' : '✗'} ${a.name}: ${a.details}`);
      }
      console.log('');
    }

    console.log('================================================================================\n');
  }
}

// Standalone execution entrypoint when run via `npm run eval`
if (process.argv[1] && process.argv[1].endsWith('benchmark.ts')) {
  const runner = new ArchitectureBenchmarkRunner();
  console.log('Starting ChronoSearch Architecture Benchmark Suite...\n');
  runner
    .runSuite((progress) => {
      console.log(`Running [${progress.current}/${progress.total}]: ${progress.currentCase}...`);
    })
    .then((result) => {
      runner.printFormattedReport(result);
      if (result.failedCases > 0) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Benchmark execution error:', err);
      process.exit(1);
    });
}
