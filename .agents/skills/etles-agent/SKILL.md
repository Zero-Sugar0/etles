---
name: etles-agent
description: >
  Core Etles Agent Infrastructure, Architecture, and Tools. Use this skill when modifying or extending Etles's core capabilities, editing sub-agents or the executive command layer, handling webhooks (Telegram, GChat, Composio), dealing with long-term memory (Upstash Vector) or the knowledge graph, autonomous missions, scheduling cron jobs/reminders (QStash), business framework seeding, A2A agent collaboration, or adjusting the main chat router (`app/(chat)/api/chat/route.ts`). Triggers on "subagent", "executive", "department", "memory", "knowledge graph", "schedule", "qstash", "upstash", "composio webhook", "telegram webhook", "gchat webhook", "heartbeat", "synthesis", "daytona", "sandbox", "approval", "mission", "business framework", "A2A", and "chat route".
---

# Etles Agent Infrastructure

This document is the authoritative guide for the Etles Agent architecture. It covers real-time chat, session persistence, long-term memory, durable subagents, proactive heartbeats, autonomous missions, and secure execution sandboxes.

## 1. Core Chat Interaction (`app/(chat)/api/chat/route.ts`)
The primary entry point for user interaction. It manages the conversation lifecycle and tool injection.
- **Entitlements**: Enforces rate limits and feature access based on `UserType`.
- **Tool Injection**: Automatically injects `Composio` tools for authenticated users.
- **Streaming**: Uses the AI SDK to stream text and tool call results via `createUIMessageStream`.
- **Persistence**: Saves user and assistant messages to the database via `saveMessages`.
- **UI Components**: Uses `renderChart`, `createDocument`, and `updateDocument` for rich interactive outputs.

## 2. Context & Memory Management

### Short-Term: Session Continuity (`lib/session-tail.ts`)
Maintains conversation context across page reloads and new chats using Redis.
- **Storage**: Keeps the last 2 messages (`TAIL_SIZE = 2`) per user in Redis (`session-tail:{userId}`).
- **Key format**: `session-tail:{userId}` with a 30-day TTL.
- **Injection**: `getSessionTail` retrieves this context and injects it into the system prompt of new chats so the agent "remembers" the immediate past.

### Long-Term: Persistent Memory (`lib/ai/tools/memory.ts`)
Uses **Upstash Vector** for semantic, per-user persistent memory.
- **Namespace**: `memory-{userId}`.
- **Embedding Model**: Uses `text-embedding-3-small` at the index level for automatic text embedding of raw strings.
- **Tools**:
  - `saveMemory`: Upserts a memory tuple `(key, content, tags)`.
  - `recallMemory`: Queries semantic matches using `topK`.
  - `updateMemory`: Overwrites an existing key with new content.
  - `deleteMemory`: Removes a specific key.

## 3. Distributed AI Routing & Providers (`lib/ai/providers.ts` & `lib/ai/models.ts`)
Etles uses a sophisticated routing layer to balance cost, speed, and capability.
- **AI Gateway**: Most traffic (including Title and Artifact models) routes through an AI Gateway for logging and load balancing.
- **Direct Providers**: Critical background tasks (Subagents, Heartbeats) use `getGoogleModel` to bypass the gateway and talk directly to Google Gemini for maximum reliability.
- **Model Selection & Tiering**:
  - **Default Chat Model**: `moonshotai/kimi-k2.5`.
  - **Title Model**: `google/gemma-4-26b-a4b-it` (via `titleModel.id`).
  - **Subagent Model**: Configurable via `SUBAGENT_MODEL` env var, defaults to `minimax/minimax-m3`.
  - **Premium Models**: `anthropic/claude-sonnet-4.8`, `anthropic/claude-opus-4.8`, `openai/gpt-5-mini`.
  - **Lightweight Models**: `google/gemini-3-flash`, `openai/gpt-4.1-nano`, `openai/gpt-5-nano`.
  - **Reasoning Models**: Models with `provider: "reasoning"` (e.g., `deepseek/deepseek-r1`, `anthropic/claude-sonnet-4.8-thinking`, `xai/grok-3-thinking`).
  - **Gateway Order**: Each model specifies `gatewayOrder` for provider failover (e.g., `["anthropic", "bedrock"]`).
  - **Reasoning Effort**: Configurable per-model via `reasoningEffort` field (`none` | `minimal` | `low` | `medium` | `high`).
  - **Dynamic Capabilities**: `getCapabilities()` fetches real-time model capabilities (tools, vision, reasoning) from the AI Gateway.
  - **Model Availability**: `getModelAvailability()` checks endpoint health (uptime, latency) for proactive incident detection.
- **Mocking**: Full support for `isTestEnvironment` using `models.mock` for local development.

## 4. Autonomous Agents, Executive Layer & Tasks

### Executive Command Layer (`lib/agent/registry/department-leads.ts`)
A C-Suite tier above the departments, with aggressive autonomous execution directives ("act first, report later"):
- **`executive_lead`** (CEO): Orchestrates all 15 departments, enforces strategic OKRs, resolves inter-departmental blocks, presents unified executive intelligence.
- **`product_lead`** (CPO): Owns product roadmap, feature prioritization, PRD specification, UX research integration.
- **`analytics_lead`** (CAO): Enterprise BI, SaaS telemetry, predictive revenue modeling.
- **`supply_chain_lead`**: Logistics, 3PL fulfillment, inventory health.
- **`partnerships_lead`**: Channel reseller agreements, co-marketing, tech alliances.
- Each lead owns a KPI/P&L dashboard, runs internal standups with specialists, escalates only exceptions to the C-suite, and reports weekly scorecards to the COO.

### Department Structure (`lib/agent/departments.ts`)
**15 departments** with 85+ specialized agents:
- **Executive & Operations** (`executive_ops`): 13 agents including chief_of_staff, inbox_operator, project_manager, task_coordinator, etc.
- **Sales & Revenue** (`sales`): 9 agents including sdr, demo_closer, competitive_intel, deal_desk, revops_control_tower, etc.
- **Marketing & Brand** (`marketing`): 9 agents including social_media, growth_hacker, ads_manager, pr_comms_specialist, seo_content_strategist, etc.
- **Engineering & Infrastructure** (`engineering`): 10 agents including code_review, sandbox_specialist, devops_infra_architect, qa_tester, incident_response, cloud_cost, etc.
- **Product & Design** (`product`): 4 agents including product_strategist, ux_researcher, pricing_packaging, product_lead.
- **Finance & Accounting** (`finance`): 8 agents including finance, contractor_payment, stripe_churn, fpa_analyst, tax_treasury, etc.
- **Customer Success & CX** (`customer_service`): 9 agents including customer_success, customer_retention_specialist, customer_voice_intelligence, etc.
- **HR & Talent** (`hr_people`): 6 agents including hiring, compensation_benefits_specialist, employee_engagement, etc.
- **Data & Analytics** (`growth_analytics`): 4 agents including product_analytics, people_analytics, analytics_lead.
- **Research & Strategy** (`research_strategy`): strategy_ops, research_strategy_lead.
- **Legal & Compliance** (`legal_compliance`): 6 agents including legal_operator, ai_governance_officer, vendor_risk, etc.
- **Security & Trust** (`security`): security_operator, security_lead.
- **Content & Studio** (`content_creative`): 5 agents including cinematic_director, visual_designer, content_ops, etc.
- **Supply Chain & E-Commerce** (`supply_chain_ecommerce`): supply_chain_lead.
- **Partnerships & Alliances** (`partnerships_alliances`): partnerships_lead.

### Subagent Registry (`lib/agent/subagent-definitions.ts`, `lib/agent/registry/`)
Modular registry files per domain:
- `registry/core.ts` — Operations, Sales, Chief of Staff, SDR, etc.
- `registry/department-leads.ts` — C-Suite executive leads.
- `registry/finance-legal.ts` — Finance, Legal, FP&A, AI Governance.
- `registry/marketing-growth.ts` — Marketing, PR, SEO, Growth.
- `registry/dev-ops-qa.ts` — Engineering, DevOps, QA, Cloud Cost.
- `registry/creative-design.ts` — Content, Visual, E-commerce.
- `registry/support-services.ts` — Customer Success, Retention, Docs.
- `registry/hr-people.ts` — Hiring, Onboarding, Compensation.
- `registry/product-strategy.ts` — Product, UX, Strategy.
- `registry/security-compliance.ts` — Security, Compliance, Privacy.

### Business Framework Seed (`lib/agent/seed-business-framework.ts`)
Auto-seeds the knowledge graph on first agent run per user (idempotent via `kg:{userId}:seeded:business-framework` marker):
- **Business Model Canvas**: Value Proposition, Customer Segments, Revenue Streams, Cost Structure.
- **KPI Tree**: ARR, CAC, LTV, NRR with causal relations (`feeds_into`, `drives_growth`, `monetizes`).
- **OKR Template**: Quarterly objectives and key results framework.
- **WBR Scorecard**: Weekly Business Review structure (Revenue vs Plan, Pipeline, Retention, Incidents, Cash Runway).
- Invoked at the start of `runSubAgent()` via `await seedBusinessFramework(userId).catch(() => {})`.

### A2A Collaboration (`lib/ai/tools/collaborate.ts`)
Every agent can spawn and coordinate child agents:
- **`spawnChildAgent`**: Spawn another agent with a self-contained task. Supports `coordinationId` for grouping and `waitForResult` for blocking.
- **`waitForChildAgents`**: Wait for multiple spawned agents (same `coordinationId`) to complete. Max 8-minute timeout.
- **`getCollaborationStatus`**: Non-blocking status check.
- **Orchestration patterns**: Parallel fan-out, sequential chaining, conditional branching.
- **Synthesis is mandatory**: Agents must synthesize child results into one coherent narrative, not concatenate.

### Department Memory (`lib/ai/tools/department-memory.ts`)
- `readDepartmentMemory` / `writeDepartmentMemory`: Per-department shared memory keyed by agent slug.
- Agents in the same department share context so specialist work stays aligned.
- The system prompt injects the department label, lead name, and escalation instructions into every agent run.

### Execution Flow
1. `runSubAgent` creates/updates an `AgentTask` in the DB.
2. Seeds the business framework (idempotent).
3. Loads Composio tools (with `multiAccount` support).
4. Injects A2A collaboration tools, memory, knowledge graph, goals, planner, schedules, missions, scratchpad, department memory, cloud infra, database, legal, Twilio, and sandbox/browser tools.
5. Recalls relevant long-term memory.
6. Runs `generateText` with the full system prompt (agent definition + memory context + department collaboration + A2A orchestration guide).
7. Results saved as `###AGENT_RESULT###` in chat and pushed via `notifySubAgentHandoffToMainAgent`.
8. Parent agent notified via `notifyParentAgent` if spawned via A2A.

### Autonomous Missions (`lib/ai/tools/missions.ts`)
Multi-week autonomous campaigns aimed at business goals (e.g., "get 50 beta users").
- **Workflow**: Launches a 14-day durable campaign via Upstash Workflow.
- **Autonomous Activity**: The mission agent finds leads, runs outreach, and engages communities without user intervention.
- **Monitoring**: `getMissionStatus` tracks progress by querying workflow run logs.
- **Daily Reports**: The mission check-ins daily, posting progress reports directly to the user's chat.

## 5. Proactive Intelligence & Automation

### Background Intelligence (`app/api/agent/heartbeat/`)
Proactive health and context scanning that runs without user input.
- **Hourly Heartbeat**: Triggered by QStash scheduled cron. Scans Calendar, Email, and Tasks via Composio to detect urgent signals (upcoming meetings, high-priority unread emails).
- **Weekly Synthesis**: A specialized workflow that generates a week-in-review brief and saves it to Long-Term Memory.
- **Status Tracking**: Updates heartbeat health in Redis (`agent:status:{userId}:heartbeat`) and provides dashboard "Agent Is Online" indicators.
- **Signal Delivery**: Urgent items are pushed to the user via Telegram HTML formatted messages.

### Scheduling & Proactive Reminders (`lib/ai/tools/schedule.ts` & `/api/scheduled`)
Handles time-delayed tasks using **Upstash QStash**.
- **Tools**:
  - `setReminder`: One-shot delayed task (specify `delaySeconds`).
  - `setCronJob`: Recurring task using UTC cron format.
  - `listSchedules` / `deleteSchedule`: Manage existing cron jobs.
- **Proactive Agent (`app/(chat)/api/scheduled/route.ts`)**: When a schedule fires, QStash POSTs to this endpoint. It spawns a background agent to fulfill the reminder. This agent has its own system prompt and access to tools (Weather, Memory, Composio) to take autonomous action (e.g., "Send the email I scheduled").

### Composio Triggers & Webhooks (`app/api/composio/webhook/route.ts`)
Reacts to external events (GitHub commits, Slack messages, etc.) via webhooks.
- **Processing**: Recalls relevant memory context for the user and spawns a `proactive_etles` task to respond to the event immediately.

## 6. Security, Proxy & Authentication (`proxy.ts`)
Etles uses a custom proxy layer to manage session security and role-based access.
- **Path Protection**: Automatically allows public paths like `/api/auth`, `/api/composio`, and Telegram/GChat webhooks.
- **Cookie Security**: Enforces `secureCookie` in production and on SSL connections, which is critical for mobile browser compatibility.
- **Guest Access**: Uses the `guestRegex` to detect guest users and restricts their access to premium tool features.
- **Authentication**: Integrates with `next-auth/jwt` to verify user tokens before allowing internal API access.

## 7. Developer & Safety Tools

### Daytona Sandbox (`lib/ai/tools/daytona.ts`)
Secure, isolated environments for code execution and Git operations.
- **Tools**: `createSandbox`, `executeCommand`, `runCode`, `readFile`, `writeFile`, `listFiles`, `gitClone`, `gitCommit`, `gitPush`, etc.
- **Lifecycle**: Sandboxes auto-stop after inactivity (default 30m) and auto-delete after 2 hours to manage costs. Requires `DAYTONA_API_KEY`.

### Human-in-the-Loop (HITL) Approvals (`lib/ai/tools/queue-approval.ts`)
Mandatory safety gate for irreversible actions (Emails, Payments, Social Posts).
- **Queueing**: Stores the draft in Redis and sends a Telegram message with **Approve / Edit / Reject** buttons.
- **Execution**: Only proceeds with the Composio tool call once the user taps "Approve" via the Telegram callback handler.

## 8. Platform Integrations
- **Telegram**: Primary H2I (Human-to-Infrastructure) interface. Handles direct messages, inline keyboards, callback data (`edit:`, `approve:`, `reject:`), and proactive notifications.
- **Chat SDK (`lib/bot-handlers.ts`)**: Multi-platform support for Slack, Teams, Discord, GChat, etc., using unified event handlers (`onNewMention`, `onNewMessage`, `onSubscribedMessage`).
- **Webhook Registry**: Incoming updates are routed to platform-specific endpoints (e.g., `/api/webhooks/telegram/[userId]`) and must pass signature verification (e.g., `x-composio-signature`).

## 9. Knowledge Graph & Business Intelligence

### Knowledge Graph (`lib/ai/tools/knowledge-graph.ts`)
Per-user structured business knowledge stored in Redis:
- **Entities**: `{ id, name, entityType, summary, tags, aliases, facts }` — stored at `kg:{userId}:entity:{id}`.
- **Relations**: `{ fromEntityId, toEntityId, relationType, weight, evidence }` — stored at `kg:{userId}:relation:{id}` with inbound/outbound indexes.
- **Tools**: `upsertKnowledgeEntity`, `addKnowledgeRelation`, `getKnowledgeEntity`, `searchKnowledgeGraph`, `deleteKnowledgeEntity`, `deleteKnowledgeRelation`.
- **Seeded** automatically by `seedBusinessFramework()` on first agent run.

### Goals & OKRs (`lib/ai/tools/goals.ts`)
- `addGoal`, `updateGoal`, `logGoalProgress`, `listGoals`, `deleteGoal`.
- Goals are per-user and tracked with progress logs.

### Planner (`lib/ai/tools/planner.ts`)
- `createPlan`, `addPlanTask`, `updatePlanTask`, `listPlans`, `deletePlan`.
- Multi-step plans with task tracking for complex agent workflows.

### Scratchpad (`lib/ai/tools/scratchpad.ts`)
- `readScratchpad`, `writeScratchpad`, `clearScratchpad`.
- Per-chat/task working memory for intermediate agent state.

## 10. Composio Multi-Account Support
- All `composio.create()` calls include `multiAccount: { enable: true, maxAccountsPerToolkit: 5 }`.
- Users can connect multiple accounts per toolkit (e.g., work + personal Gmail) with aliases.
- The connections API (`/api/connections`) groups connected accounts per toolkit into a `connectedAccounts` array.
- The connections UI displays all connected accounts as chips with their aliases and supports adding additional accounts.
