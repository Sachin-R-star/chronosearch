export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: any;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
}

export type LLMChunkCallback = (chunk: string) => void;

export interface LLMProvider {
  name: string;
  model: string;
  isAvailable(): boolean;
  generate(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
  stream(messages: LLMMessage[], onChunk: LLMChunkCallback, options?: LLMOptions): Promise<string>;
}
