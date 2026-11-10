import { LLMMessage, LLMOptions, LLMProvider, LLMChunkCallback } from '../types.js';

export class AnthropicProvider implements LLMProvider {
  public name = 'anthropic';
  public model: string;
  private apiKey?: string;

  constructor(apiKey?: string, model: string = 'claude-3-5-sonnet-20241022') {
    this.apiKey = apiKey;
    this.model = model;
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async generate(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    if (!this.isAvailable()) throw new Error('Anthropic API key not configured');

    const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
    const chatMsgs = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        system: systemMsg,
        messages: chatMsgs,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as any;
    return data.content?.[0]?.text || '';
  }

  public async stream(
    messages: LLMMessage[],
    onChunk: LLMChunkCallback,
    options: LLMOptions = {}
  ): Promise<string> {
    if (!this.isAvailable()) throw new Error('Anthropic API key not configured');

    const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
    const chatMsgs = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        system: systemMsg,
        messages: chatMsgs,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.2,
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic stream error (${res.status}): ${err}`);
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
        if (!trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullText += parsed.delta.text;
            onChunk(parsed.delta.text);
          }
        } catch {
          // ignore parsing error
        }
      }
    }

    return fullText;
  }
}
