import { LLMMessage, LLMOptions, LLMProvider, LLMChunkCallback } from '../types.js';

export class OpenAIProvider implements LLMProvider {
  public name = 'openai';
  public model: string;
  private apiKey?: string;
  private baseUrl: string;

  constructor(apiKey?: string, model: string = 'gpt-4o', baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async generate(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    if (!this.isAvailable()) throw new Error('OpenAI API key not provided');

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 2048,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI error (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content || '';
  }

  public async stream(
    messages: LLMMessage[],
    onChunk: LLMChunkCallback,
    options: LLMOptions = {}
  ): Promise<string> {
    if (!this.isAvailable()) throw new Error('OpenAI API key not provided');

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 2048,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI stream error (${res.status}): ${errorText}`);
    }

    let fullText = '';
    const reader = res.body?.getReader();
    if (!reader) return '';

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            onChunk(delta);
          }
        } catch {
          // ignore malformed chunk
        }
      }
    }

    return fullText;
  }
}
