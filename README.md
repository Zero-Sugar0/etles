<a href="https://etles.vercel.app">
  <img alt="Etles" src="app/(chat)/opengraph-image.png">
  <h1 align="center">Etles</h1>
</a>

<p align="center">
  Etles is a production-grade, open-source autonomous AI agent platform that runs an entire business end-to-end — from executive strategy and department management to sales, marketing, engineering, finance, customer success, and operations.
</p>

<p align="center">
  <a href="https://chatbot.dev"><strong>Read Docs</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#executive-command-layer"><strong>Executive Layer</strong></a> ·
  <a href="#model-providers"><strong>Model Providers</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running locally</strong></a>
</p>
<br/>

## Features

### Executive Command Layer
- **C-Suite Agents**: CEO, COO, CFO, Chief Revenue Officer, Chief Product Officer, Chief Risk Officer, and Chief People Officer — each with aggressive autonomous execution directives ("act first, report later").
- **Cross-Departmental Orchestration**: Executive leads synthesize metrics, enforce OKRs, resolve inter-departmental blocks, and present unified intelligence.
- **Business Framework Seeding**: On first run, the knowledge graph is auto-populated with a Business Model Canvas, KPI tree (CAC, LTV, NRR, ARR), OKR templates, and Weekly Business Review (WBR) scorecards — giving every agent a shared operating model from day one.

### Autonomous Sub-Agents Framework
- **85+ specialized agents** out of the box, organized into **15 departments**:
  - Executive & Operations, Sales & Revenue, Marketing & Brand, Engineering & Infrastructure, Product & Design, Finance & Accounting, Customer Success & CX, HR & Talent, Data & Analytics, Research & Strategy, Legal & Compliance, Security & Trust, Content & Studio, Supply Chain & E-Commerce, and Partnerships & Alliances.
- Each department has a dedicated **department lead** that owns KPI dashboards, runs internal standups, escalates only exceptions to the C-suite, and reports weekly scorecards.
- Agents operate intelligently out-of-band to perform complex, multi-step actions and proactive delegations.

### Agent-to-Agent (A2A) Collaboration
- Any agent can **spawn child agents**, wait for their results, and synthesize outputs into a unified answer.
- Supports **parallel fan-out** (spawn multiple agents simultaneously), **sequential** workflows (chain outputs), and **conditional branching**.
- Agents share memory via `readDepartmentMemory` / `writeDepartmentMemory` so specialist work stays aligned within departments.

### Deep Triggers & Automations (via Composio)
- Connect to over **1000+ platforms** (Gmail, Slack, Salesforce, Stripe, GitHub, Jira, HubSpot, Linear, and more).
- **Multi-account support**: Connect multiple accounts per toolkit (e.g., work + personal Gmail) with aliases for each connection.
- Configure active background triggers in real-time, enabling reactive agent workflows.

### Advanced Agent Toolkit
- **Memory**: Agents save, recall, and update long-term user memories via Upstash Vector.
- **Knowledge Graph**: Structured business knowledge (entities, relations, facts) stored per-user in Redis. Agents can `upsertKnowledgeEntity`, `searchKnowledgeGraph`, and `addKnowledgeRelation`.
- **Goals & OKRs**: Create, update, track, and delete goals with progress logging.
- **Planner**: Create multi-step plans with task tracking.
- **Scheduling**: Fully conversational cron jobs and reminders powered by Upstash QStash.
- **Missions**: Multi-week autonomous campaigns (e.g., "get 50 beta users") with daily check-ins.
- **File Storage**: Store and retrieve files with Vercel Blob.
- **Generative UI**: Interactive components natively stream charts, documents, and real-time weather into the chat.
- **Sandboxed Code Execution**: Secure Daytona sandboxes for code execution, Git operations, and browser automation.
- **Cloud Infrastructure Tools**: AWS (S3, EC2, Lambda), GCP (Storage, Compute, Functions), Azure (Storage, VM, Functions).
- **Database Tools**: Direct query access to PostgreSQL, MySQL, and MongoDB.
- **Legal Tools**: Contract analysis and comparison.
- **Communication**: Twilio voice/SMS, Twilio WhatsApp, Telegram, and multi-platform chat SDK (Slack, Teams, Discord, GChat, GitHub, Linear).

### Human-in-the-Loop (HITL) Approvals
- Mandatory safety gate for irreversible actions (emails, payments, social posts).
- Drafts are queued in Redis and sent to Telegram with **Approve / Edit / Reject** buttons.

### Technology Stack
- [Next.js](https://nextjs.org) App Router with RSC and Server Actions.
- [AI SDK](https://ai-sdk.dev/docs/introduction) — unified API for text, structured objects, and tool calls. Supports OpenAI, Anthropic, Google, xAI, DeepSeek, and more via AI Gateway.
- [shadcn/ui](https://ui.shadcn.com) with [Tailwind CSS](https://tailwindcss.com) and [Radix UI](https://radix-ui.com) primitives.
- [Neon Serverless Postgres](https://vercel.com/marketplace/neon) for chat history and user data.
- [Vercel Blob](https://vercel.com/storage/blob) for file storage.
- [Upstash Redis](https://upstash.com) for session state, knowledge graph, and agent status.
- [Upstash Vector](https://upstash.com) for semantic long-term memory.
- [Upstash QStash](https://upstash.com) for durable scheduling and webhook delivery.
- [Upstash Workflow](https://upstash.com) for durable multi-step agent workflows.
- [Auth.js](https://authjs.dev) for secure authentication.
- [Composio](https://composio.dev) for 1000+ platform integrations.
- [Daytona](https://daytona.io) for secure code execution sandboxes.

## Model Providers

This template uses the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) to access multiple AI models through a unified interface. The default model is `moonshotai/kimi-k2.5`, with support for:

- **Anthropic**: Claude Haiku 4.5, Sonnet 4.5/4.8, Opus 4.8, and thinking variants
- **OpenAI**: GPT-4o, GPT-4.1, GPT-5 Mini/Nano, GPT OSS 120B
- **Google**: Gemini 3 Flash/Pro, Gemini 3.1/3.5 Flash, Gemma 4 26B
- **DeepSeek**: V3.1, V4 Flash/Pro, R1
- **xAI**: Grok 3, Grok Build 0.1
- **Alibaba**: Qwen 3.6 Max, Qwen 3 Coder Plus, Qwen 3.8 Max
- **Moonshot AI**: Kimi K2.5/K2.6/K2.7 Code
- **MiniMax**: M2.5/M2.7/M3
- **ZAI**: GLM-5/5.1/5.2/5V Turbo
- **Perplexity**: Sonar
- **NVIDIA**: Nemotron 3 Nano
- **Inception**: Mercury 2

### AI Gateway Authentication

**For Vercel deployments**: Authentication is handled automatically via OIDC tokens.

**For non-Vercel deployments**: Set the `AI_GATEWAY_API_KEY` environment variable in your `.env.local` file.

## Deploy Your Own

You can deploy your own version of Etles to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/templates/next.js/chatbot)

## Running locally

You will need to use the environment variables [defined in `.env.example`](.env.example) to run Etles. It's recommended you use [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) for this, but a `.env` file is all that is necessary.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various AI and authentication provider accounts.

1. Install Vercel CLI: `npm i -g vercel`
2. Link local instance with Vercel and GitHub accounts (creates `.vercel` directory): `vercel link`
3. Download your environment variables: `vercel env pull`

```bash
pnpm install
pnpm db:migrate # Setup database or apply latest database changes
pnpm dev
```

Your app should now be running on [localhost:3000](http://localhost:3000).