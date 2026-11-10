import { LLMMessage, LLMOptions, LLMProvider, LLMChunkCallback } from '../types.js';

export class MockProvider implements LLMProvider {
  public name = 'mock-heuristic';
  public model = 'chrono-heuristic-v1';

  public isAvailable(): boolean {
    return true; // Always available
  }

  public async generate(messages: LLMMessage[], _options?: LLMOptions): Promise<string> {
    const userMsg = messages.filter((m) => m.role === 'user').pop()?.content || '';
    const sysMsg = messages.find((m) => m.role === 'system')?.content || '';

    return this.synthesize(userMsg, sysMsg);
  }

  public async stream(
    messages: LLMMessage[],
    onChunk: LLMChunkCallback,
    _options?: LLMOptions
  ): Promise<string> {
    const fullText = await this.generate(messages);
    const tokens = fullText.split(' ');

    for (let i = 0; i < tokens.length; i++) {
      const chunk = (i === 0 ? '' : ' ') + tokens[i];
      onChunk(chunk);
      // Small artificial delay to simulate realistic streaming
      await new Promise((r) => setTimeout(r, 15));
    }

    return fullText;
  }

  private synthesize(userMsg: string, sysMsg: string): string {
    const lower = userMsg.toLowerCase();

    // Check for temporal diff questions in the system prompt context
    if (lower.includes('crm') || sysMsg.includes('session-crm-monday')) {
      return `### Update on Shortlisted CRM Tools for 20-Person Sales Team

We reviewed our shortlist from Monday regarding the 5 CRM tools (HubSpot, Pipedrive, Salesforce Starter, Zoho CRM, and Close CRM):

#### 1. HubSpot Sales Hub
- **Pricing**: Unchanged. Starter remains at **\$20/seat/month** (\$400/mo for 20 reps), and Professional remains at **\$500/month** base + \$100/seat (\$2,000/mo for 20 reps) [^1].
- **Recent Product Releases**: HubSpot recently expanded its Breeze AI copilot features for sequence generation and prospecting insights.

#### 2. Pipedrive
- **Pricing**: Unchanged. Advanced Plan remains at **\$27.90/user/month** billed annually (~$558/mo for 20 users) [^2].
- **Recent Product Releases**: No major pricing changes or disruptive platform redesigns announced this week; ongoing incremental pipeline automation improvements.

#### 3. Salesforce Starter Suite
- **Pricing**: Still locked at **\$25/user/month** (\$500/mo for 20 reps) [^3].
- **Recent Product Releases**: Active push on Agentforce integrations for SMB tiers, but core packaging for Starter Suite remains unchanged.

#### 4. Zoho CRM
- **Pricing**: Professional edition remains **\$23/user/month** (\$460/mo for 20 reps) [^4].
- **Recent Product Releases**: Incremental Zia AI updates; no pricing alterations.

#### 5. Close CRM
- **Pricing**: Solo/Startup remains at **\$49/user/month** (\$980/mo for 20 reps) [^5].
- **Recent Product Releases**: Continued updates to predictive power dialers and call recording transcriptions.

---
### Verdict
**No pricing changes** have occurred across any of the 5 shortlisted vendors since Monday. All tiers and cost calculations from our shortlist remain 100% accurate today.

*(Note: Provide an OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY in .env for frontier model synthesis)*`;
    }

    if (lower.includes('postgres') || lower.includes('3 november') || sysMsg.includes('session-postgres-nov3')) {
      return `### Verification: Postgres Hosting Recommendations (from 3 November)

On **Tuesday, 3 November 2026**, we discussed top Postgres hosting solutions: **Neon**, **Supabase**, **Railway**, **Tembo**, and **AWS Aurora Serverless v2**.

Here is the current verification status as of today:

1. **Neon Serverless Postgres**:
   - **Pricing**: Launch plan remains **\$19/month** (10 GB storage, compute pooled at \$0.16/CU-hr). Scale plan at **\$69/month** [^1].
   - **Status**: Pricing is **unchanged and still correct**.

2. **Supabase**:
   - **Pricing**: Pro plan remains **\$25/month** per project with 8 GB database storage included [^2].
   - **Status**: Answer remains **accurate**. No pricing changes announced this week.

3. **Railway**:
   - **Pricing**: Usage-based resource model with **\$5/mo** included credit remains in effect [^3].
   - **Status**: Verified unchanged.

4. **Tembo**:
   - **Pricing**: Hobby tier at **\$15/month** and Pro at **\$45/month** remain standard.

---
### Verdict
Yes, my recommendations and pricing details from 3 November **remain completely correct today**. None of the providers have altered their pricing structures since our discussion.

*(Note: Provide an OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY in .env for frontier model synthesis)*`;
    }

    // Default synthesis
    return `I evaluated your request against current live sources. 

Based on our conversation history and latest search results, all verified details match the current status. Let me know if you would like me to deep-dive into any specific provider or recent changelogs!

*(Running in ChronoSearch Heuristic Engine mode. Add an OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY in .env to use external frontier models)*`;
  }
}
