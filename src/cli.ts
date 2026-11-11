import readline from 'readline';
import { defaultAgent } from './agent/agent.js';
import { defaultTemporalEngine } from './agent/temporal.js';
import { defaultLLMProvider } from './llm/factory.js';
import { defaultSearchTool } from './search/tool.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  const frame = defaultTemporalEngine.getTemporalFrame();
  let currentSessionId: string | undefined = undefined;

  console.clear();
  console.log(`
\x1b[1m\x1b[34m==============================================================================\x1b[0m
\x1b[1m\x1b[36m   ⚡ CHRONOSEARCH TERMINAL CHAT (v1.0.0)\x1b[0m
\x1b[1m\x1b[34m==============================================================================\x1b[0m
  \x1b[90mCurrent Time:\x1b[0m   \x1b[32m${frame.todayHuman} (${frame.todayISO})\x1b[0m
  \x1b[90mLLM Provider:\x1b[0m   \x1b[33m${defaultLLMProvider.name.toUpperCase()} (${defaultLLMProvider.model})\x1b[0m
  \x1b[90mWeb Search:\x1b[0m     \x1b[35m${defaultSearchTool.getProviderName().toUpperCase()} (1 tool: web search)\x1b[0m
\x1b[1m\x1b[34m==============================================================================\x1b[0m
  Type your question or try one of the evaluation dataset prompts:
  - "On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?"
  - "What did I ask you on 3 November? Is your answer still correct today?"
  - "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"
  \x1b[90m(Type 'exit' or Ctrl+C to quit)\x1b[0m
\x1b[1m\x1b[34m==============================================================================\x1b[0m
`);

  const askPrompt = () => {
    rl.question('\n\x1b[1m\x1b[32mYou:\x1b[0m ', async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        askPrompt();
        return;
      }
      if (trimmed.toLowerCase() === 'exit') {
        rl.close();
        process.exit(0);
      }

      console.log();
      process.stdout.write('\x1b[1m\x1b[36mChronoSearch:\x1b[0m ');

      try {
        const message = await defaultAgent.chat(trimmed, currentSessionId, (event) => {
          if (event.type === 'token') {
            process.stdout.write(event.data.chunk);
          } else if (event.type === 'temporal_resolved' && event.data.anchor) {
            process.stdout.write(
              `\n\x1b[90m[Anchor: ${event.data.anchor.expression} -> ${event.data.anchor.anchorDate}]\x1b[0m `
            );
          } else if (event.type === 'search_planned') {
            process.stdout.write(
              `\n\x1b[90m[Search: ${event.data.queries.length} parallel queries]\x1b[0m `
            );
          }
        });

        currentSessionId = message.sessionId;

        // Print citations if any
        if (message.metadata?.citations && message.metadata.citations.length > 0) {
          console.log('\n\n\x1b[90m--------------------------------------------------\x1b[0m');
          console.log('\x1b[1m\x1b[34mVerified Sources:\x1b[0m');
          for (const c of message.metadata.citations) {
            console.log(`  \x1b[33m[${c.index}]\x1b[0m ${c.title} \x1b[90m(${c.url})\x1b[0m`);
          }
        }
      } catch (err: any) {
        console.error('\n\x1b[31mError:\x1b[0m', err.message);
      }

      askPrompt();
    });
  };

  askPrompt();
}

main().catch(console.error);

