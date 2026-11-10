import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { defaultAgent } from './agent/agent.js';
import { defaultMemoryStore } from './memory/store.js';
import { defaultTemporalEngine } from './agent/temporal.js';
import { defaultSearchTool } from './search/tool.js';
import { defaultLLMProvider } from './llm/factory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend
const publicDir = path.join(__dirname, 'web', 'public');
app.use(express.static(publicDir));

// GET /api/status
app.get('/api/status', (_req: Request, res: Response) => {
  const temporalFrame = defaultTemporalEngine.getTemporalFrame();
  res.json({
    status: 'online',
    agent: 'ChronoSearch v1.0.0',
    temporal: temporalFrame,
    llm: {
      provider: defaultLLMProvider.name,
      model: defaultLLMProvider.model,
    },
    search: {
      provider: defaultSearchTool.getProviderName(),
    },
  });
});

// GET /api/sessions
app.get('/api/sessions', (_req: Request, res: Response) => {
  const sessions = defaultMemoryStore.getAllSessions();
  res.json(sessions);
});

// GET /api/sessions/:id
app.get('/api/sessions/:id', (req: Request, res: Response) => {
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = defaultMemoryStore.getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(session);
});

// POST /api/sessions
app.post('/api/sessions', (req: Request, res: Response) => {
  const title = req.body.title || 'New Conversation';
  const session = defaultMemoryStore.createSession(title);
  res.json(session);
});

// POST /api/chat (Server-Sent Events streaming)
app.post('/api/chat', async (req: Request, res: Response) => {
  const { query, sessionId } = req.body;

  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Query is required' });
    return;
  }

  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    await defaultAgent.chat(query, sessionId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
  } catch (err: any) {
    console.error('Agent chat error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', data: { message: err.message } })}\n\n`);
  } finally {
    res.end();
  }
});

// Fallback to index.html for client-side routing
app.use((_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start HTTP server
const PORT = config.port;
app.listen(PORT, () => {
  const frame = defaultTemporalEngine.getTemporalFrame();
  const searchName = defaultSearchTool.getProviderName();
  const llmName = defaultLLMProvider.name;
  const llmModel = defaultLLMProvider.model;

  console.log(`
==============================================================================
   ⚡ CHRONOSEARCH: STATE-OF-THE-ART TEMPORAL MEMORY & SEARCH AGENT
==============================================================================
  Local Web Chat:    http://${config.host}:${PORT}
  Terminal REPL:     npm run chat
  Current Time:      ${frame.todayHuman} (${frame.todayISO})
  LLM Provider:      ${llmName.toUpperCase()} [${llmModel}]
  Search Tool:       ${searchName.toUpperCase()} (1 tool: web search)
==============================================================================
  Ready for evaluation prompts:
  1. "On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?"
  2. "What did I ask you on 3 November? Is your answer still correct today?"
  3. "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"
==============================================================================
`);
});
