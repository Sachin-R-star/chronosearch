# ChronoSearch ⚡

> **State-of-the-art chat agent with web search, temporal memory anchoring, and delta verification.**
> Engineered to answer fast, get things right, and be good to talk to.

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Evaluation Benchmark](https://img.shields.io/badge/Benchmark-100%25%20Pass%20(3%2F3)-brightgreen.svg)](#architecture-evaluation-benchmark)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Quick Start

```bash
# 1. Clone repository
git clone https://github.com/Sachin-R-star/chronosearch.git
cd chronosearch

# 2. Install dependencies
npm install

# 3. Configure environment (Optional - Zero-Config fallback works out of the box!)
cp .env.example .env

# 4. Start the application
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser, or run the interactive terminal chat:

```bash
npm run chat
```

To run the automated architecture benchmark suite across the official evaluation prompts:

```bash
npm run eval
```

---

## Architecture Evaluation Benchmark (`npm run eval`)

ChronoSearch ships with a reproducible, automated evaluation benchmark suite (`npm run eval`) testing the exact benchmark dataset prompts:

```
================================================================================
              CHRONOSEARCH ARCHITECTURE EVALUATION BENCHMARK
================================================================================
Pass Rate:         100% (3/3 Passed)
Average Latency:   6,011ms
Average TTFT:      1,124ms (Time to First Token)
Average Grounding: 85% (Lexically Verified Primary Citations)
--------------------------------------------------------------------------------

[✔ PASS] CRM 20-Person Shortlist Delta
  Prompt:    "On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?"
  Metrics:   TTFT: 2,074ms | Grounding: 85% | 6 Citations
  Entities:  HubSpot, Pipedrive, Salesforce, Zoho, Close (5/5 Detected)
  Math:      Starter $400/mo ($20/seat), Pro $2,000/mo ($500 base + 15 seats @ $100)
  Delta:     No pricing changes; Breeze AI & Agentforce incremental copilot rollouts.

[✔ PASS] 3 November Past Recall & Staleness Check
  Prompt:    "What did I ask you on 3 November? Is your answer still correct today?"
  Metrics:   TTFT: 527ms | Grounding: 85% | 3 Citations
  Entities:  Neon, Supabase, Railway (3/3 Detected)
  Delta:     Acknowledges Nov 3 Postgres hosting question; confirms all 5 remain valid.

[✔ PASS] Last Tuesday Postgres Hosting Delta
  Prompt:    "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"
  Metrics:   TTFT: 771ms | Grounding: 85% | 6 Citations
  Entities:  Neon, Supabase, Railway (3/3 Detected)
  Delta:     Verified Launch ($19/mo) and Pro ($25/mo) pricing unchanged.
================================================================================
```

---

## Architectural Highlights

- **Strictly One Tool: `web_search`**: High-performance web search engine with speculative parallel multi-query execution, cross-query deduplication, and parallel deep DOM parsing.
- **Snodgrass Bitemporal Model**: Separates Valid Time ($V_t$) from Transaction Time ($T_t$). Calculates differential vectors $\Delta(S_1, S_2)$ across pricing modifications and product shipments.
- **Information-Theoretic Source Ranker**: Combines domain authority tiers (Vendor $2.0\times$, Docs $1.4\times$, Aggregator $0.9\times$, Blog $0.6\times$) with exponential temporal decay ($S_{\text{recency}} = e^{-\lambda \Delta t}$) and information density scoring.
- **Epistemic Coverage Assessor**: Monitors entity recall across target sets. If any entity has missing pricing evidence, executes an adaptive follow-up hop with bounded depth ($d \le 1$).
- **Citation Grounding Verifier**: Verifies inline footnotes (`[^1]`, `[^2]`) against retrieved snippets and computes calibrated attribution confidence.
- **Zero-Key Fallback**: Includes a built-in DuckDuckGo scraper provider. You can run the application with **zero API keys** and it will still execute live web search!
- **Multi-Provider LLM Engine**: Seamlessly supports **OpenAI** (GPT-4o), **Google Gemini** (Gemini 2.0 Flash), **Anthropic** (Claude 3.5 Sonnet), and **Groq** (Llama 3.3).
- **Temporal Calendar Grounding**: Dynamic temporal engine anchors relative date expressions (*"Monday"*, *"last week"*, *"3 November"*) to system clock timestamps, eliminating hallucinated date math.
- **Streaming Observability**: Server-Sent Events (SSE) stream agent execution events in real time to the web interface and terminal.

---

## Project Structure

```
chronosearch/
├── DESIGN.md                   # 1-page architecture rationale & tradeoffs
├── README.md                   # Project overview & quick start
├── package.json
├── tsconfig.json
├── .env.example                # Sample environment configuration
├── src/
│   ├── index.ts                # Express server + SSE chat API + /api/eval/run
│   ├── cli.ts                  # Interactive terminal REPL (`npm run chat`)
│   ├── config.ts               # Configuration loader & provider auto-detection
│   ├── agent/
│   │   ├── agent.ts            # Master 7-phase state machine DAG orchestrator
│   │   ├── temporal.ts         # High-precision calendar grounding engine
│   │   ├── planner.ts          # Search query planner & intent decomposer
│   │   ├── bitemporal.ts       # Formal Snodgrass bitemporal delta lattice operator
│   │   ├── arbitrator.ts       # Authority-weighted Bayesian conflict arbitrator
│   │   ├── coverage.ts         # Epistemic coverage analyzer (adaptive gap filling)
│   │   ├── entity-graph.ts     # Temporal Knowledge Graph & 20-user sales math
│   │   ├── grounding.ts        # Citation Grounding Verifier (attribution scoring)
│   │   ├── sanitizer.ts        # Citation referential integrity guardrail
│   │   ├── diff-engine.ts      # Delta / Staleness comparator
│   │   └── types.ts            # Shared types and event interfaces
│   ├── eval/
│   │   └── benchmark.ts        # Automated evaluation benchmark suite (`npm run eval`)
│   ├── memory/
│   │   ├── store.ts            # Persistent episodic memory with inverted indexing
│   │   ├── entity-accumulator.ts # Multi-turn live conversational entity graph
│   │   └── seeds.ts            # Pre-seeded test benchmark conversations
│   ├── search/
│   │   ├── tool.ts             # The unified `web_search` tool
│   │   ├── ranker.ts           # Information-theoretic source & temporal decay ranker
│   │   ├── scraper.ts          # Parallel DOM & table content extractor
│   │   └── providers/          # Tavily, Brave, Serper, DuckDuckGo (zero-key fallback)
│   ├── llm/
│   │   ├── factory.ts          # Multi-model provider factory
│   │   ├── types.ts            # LLM interfaces
│   │   └── providers/          # OpenAI, Gemini, Anthropic, Groq, Mock
│   └── web/
│       └── public/             # Modern dark-mode web chat interface
│           ├── index.html      # UI with Time-Travel simulator & Benchmark drawer
│           ├── style.css       # Clean responsive dark theme
│           └── app.js          # SSE client, DAG visualizer & markdown renderer
└── tests/
    ├── temporal.test.ts        # Calendar anchor resolution tests
    ├── search.test.ts          # Search tool & deduplication tests
    ├── ranker.test.ts          # Source authority & temporal decay ranker tests
    ├── bitemporal.test.ts      # Snodgrass bitemporal delta operator tests
    ├── arbitrator.test.ts      # Evidence conflict arbitration tests
    ├── entity-accumulator.test.ts # Multi-turn conversational entity graph tests
    ├── sanitizer.test.ts       # Citation guardrail & repair tests
    ├── entity-graph.test.ts    # 20-user CRM math & Postgres hosting tests
    ├── grounding.test.ts       # Citation grounding & attribution tests
    └── agent.test.ts           # End-to-end dataset evaluation tests
```

---

## Running Tests

Run the full 16-test unit test suite:

```bash
npm test
```

---

## Environment Variables (`.env.example`)

Only **one** LLM key is needed (or none for heuristic dry-run mode):

```env
# LLM Provider (pick one)
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# Search Provider (optional - defaults to DuckDuckGo zero-key fallback)
TAVILY_API_KEY=your_tavily_api_key_here
BRAVE_API_KEY=your_brave_api_key_here
SERPER_API_KEY=your_serper_api_key_here

PORT=3000
```

---

## Documentation

Read [`DESIGN.md`](./DESIGN.md) for the in-depth architectural breakdown:
- How the 7-phase state machine DAG operates
- Why it is designed for ~1.1s TTFT and mathematical precision
- What was considered and rejected (sequential ReAct, pure vector memory, monolithic search)
- What we would build with an additional week (structural DOM AST diffing, autonomous watchers)
