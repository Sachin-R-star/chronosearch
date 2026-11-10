import { LLMProvider } from './types.js';
import { OpenAIProvider } from './providers/openai.js';
import { GeminiProvider } from './providers/gemini.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { MockProvider } from './providers/mock.js';
import { AppConfig, config } from '../config.js';

export function createLLMProvider(cfg: AppConfig = config): LLMProvider {
  const { provider, model, openaiApiKey, geminiApiKey, anthropicApiKey, groqApiKey } = cfg.llm;

  switch (provider) {
    case 'openai':
      return new OpenAIProvider(openaiApiKey, model || 'gpt-4o');
    case 'gemini':
      return new GeminiProvider(geminiApiKey, model || 'gemini-2.0-flash');
    case 'anthropic':
      return new AnthropicProvider(anthropicApiKey, model || 'claude-3-5-sonnet-20241022');
    case 'groq':
      return new OpenAIProvider(groqApiKey, model || 'llama-3.3-70b-versatile', 'https://api.groq.com/openai/v1');
    case 'mock':
    default:
      return new MockProvider();
  }
}

export const defaultLLMProvider = createLLMProvider();
