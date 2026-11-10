import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface AppConfig {
  port: number;
  host: string;
  llm: {
    provider: 'openai' | 'gemini' | 'anthropic' | 'groq' | 'mock' | 'auto';
    model: string;
    openaiApiKey?: string;
    geminiApiKey?: string;
    anthropicApiKey?: string;
    groqApiKey?: string;
  };
  search: {
    provider: 'tavily' | 'brave' | 'serper' | 'duckduckgo' | 'auto';
    tavilyApiKey?: string;
    braveApiKey?: string;
    serperApiKey?: string;
    maxParallelSearches: number;
    scrapeTimeoutMs: number;
  };
  storage: {
    dataPath: string;
  };
}

export function loadConfig(): AppConfig {
  const env = process.env;

  // Auto-detect LLM provider based on available keys
  let llmProvider: AppConfig['llm']['provider'] = (env.LLM_PROVIDER as any) || 'auto';
  if (llmProvider === 'auto') {
    if (env.OPENAI_API_KEY) llmProvider = 'openai';
    else if (env.GEMINI_API_KEY) llmProvider = 'gemini';
    else if (env.ANTHROPIC_API_KEY) llmProvider = 'anthropic';
    else if (env.GROQ_API_KEY) llmProvider = 'groq';
    else llmProvider = 'mock'; // Graceful zero-key fallback
  }

  // Auto-detect Search provider based on available keys
  let searchProvider: AppConfig['search']['provider'] = (env.SEARCH_PROVIDER as any) || 'auto';
  if (searchProvider === 'auto') {
    if (env.TAVILY_API_KEY) searchProvider = 'tavily';
    else if (env.BRAVE_API_KEY) searchProvider = 'brave';
    else if (env.SERPER_API_KEY) searchProvider = 'serper';
    else searchProvider = 'duckduckgo'; // Zero-config fallback
  }

  // Auto-select sensible default model per provider
  let defaultModel = env.LLM_MODEL || 'auto';
  if (defaultModel === 'auto') {
    switch (llmProvider) {
      case 'openai':
        defaultModel = 'gpt-4o';
        break;
      case 'gemini':
        defaultModel = 'gemini-2.0-flash';
        break;
      case 'anthropic':
        defaultModel = 'claude-3-5-sonnet-20241022';
        break;
      case 'groq':
        defaultModel = 'llama-3.3-70b-versatile';
        break;
      default:
        defaultModel = 'mock-heuristic-v1';
        break;
    }
  }

  return {
    port: parseInt(env.PORT || '3000', 10),
    host: env.HOST || 'localhost',
    llm: {
      provider: llmProvider,
      model: defaultModel,
      openaiApiKey: env.OPENAI_API_KEY,
      geminiApiKey: env.GEMINI_API_KEY,
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      groqApiKey: env.GROQ_API_KEY,
    },
    search: {
      provider: searchProvider,
      tavilyApiKey: env.TAVILY_API_KEY,
      braveApiKey: env.BRAVE_API_KEY,
      serperApiKey: env.SERPER_API_KEY,
      maxParallelSearches: parseInt(env.MAX_PARALLEL_SEARCHES || '3', 10),
      scrapeTimeoutMs: parseInt(env.SCRAPE_TIMEOUT_MS || '2000', 10),
    },
    storage: {
      dataPath: path.resolve(process.cwd(), 'data'),
    },
  };
}

export const config = loadConfig();
