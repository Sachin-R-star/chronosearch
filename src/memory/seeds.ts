import { ConversationSession } from '../agent/types.js';

export function getSeedSessions(referenceDate: Date = new Date()): ConversationSession[] {
  // Anchored around Nov 3 (Last Tuesday) and Monday (Nov 9 or recent Monday)
  const nov3 = new Date(referenceDate.getFullYear(), 10, 3, 14, 32, 0); // Tuesday, Nov 3, 2026 14:32:00
  const nov9 = new Date(referenceDate.getFullYear(), 10, 9, 10, 15, 0); // Monday, Nov 9, 2026 10:15:00

  return [
    {
      id: 'session-postgres-nov3',
      title: 'Postgres Hosting Comparison & Recommendations',
      createdAt: nov3.toISOString(),
      updatedAt: new Date(nov3.getTime() + 15 * 60 * 1000).toISOString(),
      tags: ['postgres', 'hosting', 'database', 'neon', 'supabase', 'railway', 'tembo', 'aurora'],
      entitySnapshots: [
        {
          name: 'Neon',
          category: 'database',
          baselineDate: '2026-11-03',
          attributes: {
            pricingTiers: {
              free: '$0/mo (0.5 GB storage, 1 project)',
              launch: '$19/mo (10 GB storage, compute pooled at $0.16/CU-hour)',
              scale: '$69/mo (50 GB storage, autoscaling up to 8 CU)',
            },
            keyFeatures: ['Instant branching (copy-on-write)', 'Scale-to-zero compute', 'Decoupled storage'],
          },
        },
        {
          name: 'Supabase',
          category: 'database',
          baselineDate: '2026-11-03',
          attributes: {
            pricingTiers: {
              free: '$0/mo (500 MB database, pauses after 1 wk inactivity)',
              pro: '$25/mo per project (8 GB disk, 250 GB egress, daily backups)',
              team: '$599/mo (SOC2, Priority Support)',
            },
            keyFeatures: ['Postgres 15/16', 'Built-in Auth', 'Realtime engine', 'pgvector'],
          },
        },
        {
          name: 'Railway',
          category: 'infra',
          baselineDate: '2026-11-03',
          attributes: {
            pricingTiers: {
              hobby: '$5/mo platform usage credit included',
              usage: 'Compute: $0.000231/vCPU/min (~$10/vCPU/mo), RAM: $0.000046/GB/min (~$2/GB/mo)',
            },
            keyFeatures: ['PaaS developer workflow', 'Automated SSL and volumes', 'Private networking'],
          },
        },
        {
          name: 'Tembo',
          category: 'database',
          baselineDate: '2026-11-03',
          attributes: {
            pricingTiers: {
              hobby: '$15/mo for basic development',
              pro: '$45/mo with automated backups and high availability',
            },
            keyFeatures: ['200+ curated extensions', 'pg_vector', 'Timescale', 'Columnar'],
          },
        },
        {
          name: 'AWS Aurora Serverless v2',
          category: 'database',
          baselineDate: '2026-11-03',
          attributes: {
            pricingTiers: {
              acu: '~$0.12 per ACU-hour (minimum 0.5 ACU = ~$43/mo base per instance)',
            },
            keyFeatures: ['Multi-AZ autoscaling', 'Enterprise AWS IAM & VPC governance'],
          },
        },
      ],
      messages: [
        {
          id: 'msg-pg-1',
          sessionId: 'session-postgres-nov3',
          role: 'user',
          content: 'I need recommendations for Postgres hosting for our new SaaS app. What are the top modern options, how do they compare on features, and what is their pricing?',
          timestamp: nov3.toISOString(),
        },
        {
          id: 'msg-pg-2',
          sessionId: 'session-postgres-nov3',
          role: 'assistant',
          content: `Here is the current landscape of modern managed PostgreSQL hosting providers:

### 1. Neon (Serverless Postgres)
- **Architecture**: Decoupled compute and storage with instant branching (copy-on-write) for development/staging environments and scale-to-zero.
- **Pricing**:
  - **Free Tier**: 0.5 GB storage, 1 project.
  - **Launch Plan**: \$19/month (includes 10 GB storage, compute pooled at \$0.16/CU-hour).
  - **Scale Plan**: \$69/month with autoscaling up to 8 CU, SOC 2 compliance, and 50 GB storage included.
- **Best For**: Jamstack/serverless apps, CI/CD database branching workflows.

### 2. Supabase (Postgres + Backend Platform)
- **Architecture**: Managed Postgres 15/16 with built-in Auth, Realtime engine, Storage, and \`pgvector\` for AI workloads.
- **Pricing**:
  - **Free Tier**: 500 MB database, 2 free projects (pauses after 1 week inactivity).
  - **Pro Plan**: \$25/month per project (includes 8 GB disk, 250 GB egress, daily backups). Compute add-ons from \$10/mo (Small) to \$1,000/mo (16XL).
  - **Team Plan**: \$599/month (SOC2, Priority Support).
- **Best For**: Teams wanting a comprehensive Firebase alternative backed by vanilla Postgres.

### 3. Railway (Modern Developer PaaS)
- **Architecture**: Docker-native platform with automated Postgres service deployment, private networking, and automated SSL/volumes.
- **Pricing**:
  - **Hobby Plan**: \$5/month usage credit included.
  - **Usage-based resources**: Compute billed at \$0.000231/vCPU/min (~$10/vCPU/mo) and \$0.000046/GB RAM/min (~$2/GB RAM/mo).
- **Best For**: Fast prototyping and deploying full-stack apps alongside the database.

### 4. Tembo (Extension-Centric Postgres)
- **Architecture**: Postgres optimized with 200+ curated extensions (pg_vector, pg_search, Timescale, columnar).
- **Pricing**:
  - **Hobby Tier**: \$15/month for basic development.
  - **Pro Tier**: \$45/month with automated backups and high availability.
- **Best For**: Specialized workloads (vector search, time-series) wanting curated Postgres stacks.

### 5. AWS Aurora Serverless v2 (Enterprise Managed)
- **Architecture**: Multi-AZ autoscaling Postgres cluster with millisecond scaling and shared distributed storage.
- **Pricing**:
  - ACU (Aurora Capacity Unit) billed at ~\$0.12 per ACU-hour (minimum 0.5 ACU = ~$43/month base per instance before storage & I/O).
- **Best For**: Enterprise teams already invested in AWS VPCs and IAM governance.`,
          timestamp: new Date(nov3.getTime() + 65 * 1000).toISOString(),
          metadata: {
            citations: [
              { index: 1, url: 'https://neon.tech/pricing', title: 'Neon Serverless Postgres Pricing', domain: 'neon.tech' },
              { index: 2, url: 'https://supabase.com/pricing', title: 'Supabase Pricing Plans', domain: 'supabase.com' },
              { index: 3, url: 'https://railway.app/pricing', title: 'Railway Cloud Platform Pricing', domain: 'railway.app' },
            ],
          },
        },
      ],
    },
    {
      id: 'session-crm-monday',
      title: 'Shortlisting 5 CRM Tools for a 20-Person Sales Team',
      createdAt: nov9.toISOString(),
      updatedAt: new Date(nov9.getTime() + 20 * 60 * 1000).toISOString(),
      tags: ['crm', 'sales', 'evaluation', 'pricing', 'hubspot', 'pipedrive', 'salesforce', 'zoho', 'close'],
      entitySnapshots: [
        {
          name: 'HubSpot Sales Hub',
          category: 'crm',
          baselineDate: '2026-11-09',
          attributes: {
            pricingTiers: {
              starter: '$20/seat/month billed annually',
              pro: '$500/month base (includes 5 seats) + $100/extra seat/month',
            },
            teamSizeCalculations: {
              team20Starter: '$400/month ($4,800/year)',
              team20Pro: '$2,000/month ($24,000/year) + one-time $1,500 onboarding',
            },
            keyFeatures: ['Built-in marketing alignment', 'Email templates & sequences', 'Meeting scheduler', 'Breeze AI copilot'],
          },
        },
        {
          name: 'Pipedrive',
          category: 'crm',
          baselineDate: '2026-11-09',
          attributes: {
            pricingTiers: {
              advanced: '$27.90/user/month billed annually',
              professional: '$49.90/user/month billed annually',
            },
            teamSizeCalculations: {
              team20Advanced: '$558/month ($6,696/year)',
              team20Pro: '$998/month ($11,976/year)',
            },
            keyFeatures: ['Visual pipeline management', 'Two-way email sync', 'Email automations', 'Revenue forecasting'],
          },
        },
        {
          name: 'Salesforce Starter Suite',
          category: 'crm',
          baselineDate: '2026-11-09',
          attributes: {
            pricingTiers: {
              starter: '$25/user/month billed annually',
              pro: '$100/user/month billed annually',
            },
            teamSizeCalculations: {
              team20Starter: '$500/month ($6,000/year)',
              team20Pro: '$2,000/month ($24,000/year)',
            },
            keyFeatures: ['Simplified SMB interface', 'Unified CRM + email', 'Agentforce AI previews'],
          },
        },
        {
          name: 'Zoho CRM',
          category: 'crm',
          baselineDate: '2026-11-09',
          attributes: {
            pricingTiers: {
              professional: '$23/user/month billed annually',
              enterprise: '$40/user/month billed annually',
            },
            teamSizeCalculations: {
              team20Professional: '$460/month ($5,520/year)',
              team20Enterprise: '$800/month ($9,600/year)',
            },
            keyFeatures: ['SalesSignals', 'Blueprint process management', 'Zia AI assistant', 'Telephony integration'],
          },
        },
        {
          name: 'Close CRM',
          category: 'crm',
          baselineDate: '2026-11-09',
          attributes: {
            pricingTiers: {
              startup: '$49/user/month billed annually',
              professional: '$99/user/month billed annually',
            },
            teamSizeCalculations: {
              team20Startup: '$980/month ($11,760/year)',
              team20Professional: '$1,980/month ($23,760/year)',
            },
            keyFeatures: ['Built-in VoIP calling & SMS', 'Predictive power dialer', 'Multi-channel outbound sequences'],
          },
        },
      ],
      messages: [
        {
          id: 'msg-crm-1',
          sessionId: 'session-crm-monday',
          role: 'user',
          content: 'We need to shortlist 5 CRM tools for our 20-person sales team. Key criteria: visual pipeline management, email cadence/sequences, CRM reporting, and easy onboarding without enterprise overhead. What are the 5 best tools and their total cost for 20 users?',
          timestamp: nov9.toISOString(),
        },
        {
          id: 'msg-crm-2',
          sessionId: 'session-crm-monday',
          role: 'assistant',
          content: `Here is our curated shortlist of the **5 best CRM tools for a 20-person sales team**, tailored to visual pipelines, email sequencing, and fast adoption:

### 1. HubSpot Sales Hub
- **Strengths**: Gold standard in usability, built-in marketing alignment, intuitive email templates and meeting scheduler.
- **Pricing for 20 users**:
  - **Sales Hub Starter**: \$20/seat/month billed annually = **\$400/month** (\$4,800/year). Good basic pipelines and email tracking.
  - **Sales Hub Professional**: \$500/month base (includes 5 seats) + \$100/seat/mo for 15 additional seats = **\$2,000/month** (\$24,000/year) + one-time \$1,500 onboarding. Required for automated sequences and custom reporting.

### 2. Pipedrive
- **Strengths**: Best-in-class pipeline visualizer built by salespeople for salespeople; lightweight, zero friction.
- **Pricing for 20 users**:
  - **Advanced Plan**: \$27.90/user/month billed annually = **\$558/month** (\$6,696/year). Includes two-way email sync, email sequences, and workflow automations.
  - **Professional Plan**: \$49.90/user/month = **\$998/month** (\$11,976/year) for custom revenue forecasting and team management.

### 3. Salesforce Starter Suite
- **Strengths**: Simplified, modern Salesforce without the complex setup; unified CRM, sales email, and marketing.
- **Pricing for 20 users**:
  - **Starter Suite**: \$25/user/month billed annually = **\$500/month** (\$6,000/year).
  - **Pro Suite**: \$100/user/month = **\$2,000/month** (\$24,000/year) if you need advanced custom automation and lead scoring.

### 4. Zoho CRM
- **Strengths**: Exceptional feature-to-dollar ratio, deep customization, integrated telephony and omnichannel communications.
- **Pricing for 20 users**:
  - **Professional Edition**: \$23/user/month billed annually = **\$460/month** (\$5,520/year). Includes SalesSignals, blueprint process management, and email automations.
  - **Enterprise Edition**: \$40/user/month = **\$800/month** for Zia AI and multi-pipeline forecasting.

### 5. Close CRM
- **Strengths**: Built specifically for outbound transactional sales with integrated VoIP calling, SMS, and power dialers right inside the CRM.
- **Pricing for 20 users**:
  - **Solo/Startup**: \$49/user/month billed annually = **\$980/month** (\$11,760/year). Includes full email automation, pipeline view, and built-in calling.
  - **Professional**: \$99/user/month = **\$1,980/month** for multi-channel sequences (email + SMS + call tasks).

### Summary Recommendation for 20 Reps:
- **Best overall balance & UX**: **Pipedrive Advanced** (\$558/mo total) or **HubSpot Starter** (\$400/mo).
- **If outbound calling/dialing is core**: **Close CRM** (\$980/mo).
- **If maximum value per dollar with deep workflows**: **Zoho CRM Professional** (\$460/mo).`,
          timestamp: new Date(nov9.getTime() + 80 * 1000).toISOString(),
          metadata: {
            citations: [
              { index: 1, url: 'https://www.hubspot.com/pricing/sales', title: 'HubSpot Sales Hub Pricing', domain: 'hubspot.com' },
              { index: 2, url: 'https://www.pipedrive.com/en/pricing', title: 'Pipedrive Plans & Pricing', domain: 'pipedrive.com' },
              { index: 3, url: 'https://www.salesforce.com/editions-pricing/starter-suite/', title: 'Salesforce Starter Suite Pricing', domain: 'salesforce.com' },
              { index: 4, url: 'https://www.zoho.com/crm/zohocrm-pricing.html', title: 'Zoho CRM Pricing Plans', domain: 'zoho.com' },
              { index: 5, url: 'https://www.close.com/pricing', title: 'Close CRM Pricing', domain: 'close.com' },
            ],
          },
        },
      ],
    },
  ];
}
