export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
}

export type LLMChunkCallback = (chunk: string) => void;

export interface LLMProvider {
  name: string;
  model: string;
  isAvailable(): boolean;
  generate(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
  stream(messages: LLMMessage[], onChunk: LLMChunkCallback, options?: LLMOptions): Promise<string>;
}
