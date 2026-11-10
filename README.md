# ChronoSearch ⚡

> **State-of-the-art chat agent with web search, temporal memory anchoring, and delta verification.**
> Engineered to answer fast, get things right, and be good to talk to.

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
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

---

## Benchmark Evaluation Prompts

ChronoSearch is specifically engineered to excel on temporal memory and delta web search queries. The repository includes pre-seeded evaluation sessions matching the test dataset:

| # | Evaluation Prompt | How ChronoSearch Solves It |
|---|---|---|
| **1** | *"On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?"* | Resolves **Monday** to exact calendar date. Recalls the 5 shortlisted vendors (HubSpot, Pipedrive, Salesforce Starter, Zoho, Close) and baseline pricing. Decomposes into parallel search queries for pricing updates and changelogs. Synthesizes a verified diff report with source citations. |
| **2** | *"What did I ask you on 3 November? Is your answer still correct today?"* | Anchors **3 November** to the exact day. Recalls the Postgres hosting inquiry and past answer from episodic memory. Runs live verification searches across Neon, Supabase, and Railway. Confirms answer validity with verified links. |
| **3** | *"Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"* | Maps **Last Tuesday** to the exact 7-day offset. Extracts baseline tier costs. Issues parallel delta searches on official pricing pages and changelogs to verify whether pricing remained stable. |

---

## Architectural Highlights

- **The One Tool: `web_search`**: Implements a high-performance web search engine with parallel multi-query execution, result deduplication, and deep content scraping.
- **Zero-Key Fallback**: Includes a built-in DuckDuckGo scraper provider. You can run the application with **zero API keys** and it will still execute live web search!
- **Multi-Provider LLM Engine**: Seamlessly supports **OpenAI** (GPT-4o), **Google Gemini** (Gemini 2.0 Flash), **Anthropic** (Claude 3.5 Sonnet), and **Groq** (Llama 3.3). Auto-detects configured keys from `.env`.
- **Temporal Calendar Grounding**: Dynamic temporal engine anchors relative date expressions (*"Monday"*, *"last week"*, *"3 November"*) to system clock timestamps, eliminating hallucinated date math.
- **Delta & Staleness Engine**: Distinct from standard RAG. Compares baseline state ($T_{0}$) vs live verified findings ($T_{\text{now}}$) to report changes, unchanged stability, and new feature drops.
- **Streaming Observability**: Server-Sent Events (SSE) stream agent execution events in real time (`temporal_resolved` &rarr; `memory_recalled` &rarr; `search_planned` &rarr; `token`) to the web interface and terminal.

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
│   ├── index.ts                # Express server + SSE chat API
│   ├── cli.ts                  # Interactive terminal REPL (`npm run chat`)
│   ├── config.ts               # Configuration loader & provider auto-detection
│   ├── agent/
│   │   ├── agent.ts            # Master orchestrator (temporal -> memory -> search -> diff -> stream)
│   │   ├── temporal.ts         # High-precision calendar grounding engine
│   │   ├── planner.ts          # Search query planner & intent decomposer
│   │   ├── diff-engine.ts      # Delta / Staleness comparator
│   │   └── types.ts            # Shared types and event interfaces
│   ├── memory/
│   │   ├── store.ts            # Persistent episodic memory with temporal-window indexing
│   │   └── seeds.ts            # Pre-seeded test benchmark conversations
│   ├── search/
│   │   ├── tool.ts             # The unified `web_search` tool
│   │   ├── scraper.ts          # Parallel page content extractor
│   │   └── providers/
│   │       ├── duckduckgo.ts   # Zero-config search scraper (no key required)
│   │       ├── tavily.ts       # Tavily AI search integration
│   │       ├── brave.ts        # Brave search integration
│   │       └── serper.ts       # Google Serper integration
│   ├── llm/
│   │   ├── factory.ts          # Multi-model provider factory
│   │   ├── types.ts            # LLM interfaces
│   │   └── providers/          # OpenAI, Gemini, Anthropic, Groq, Mock
│   └── web/
│       └── public/             # Modern dark-mode web chat interface
│           ├── index.html
│           ├── style.css
│           └── app.js
└── tests/
    ├── temporal.test.ts        # Calendar anchor resolution tests
    ├── search.test.ts          # Search tool & deduplication tests
    └── agent.test.ts           # End-to-end dataset evaluation tests
```

---

## Running Tests

Run the comprehensive test suite verifying calendar grounding, search tool execution, and end-to-end agent workflows:

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
- How the pipeline operates
- Why it is designed for sub-1.5s latency and high precision
- What was considered and rejected (sequential ReAct, pure vector memory, monolithic search)
- What we would build with an additional week (DOM diffing, background watcher daemons)
