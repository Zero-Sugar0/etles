# Subagents
*Operational contract for delegating work to Etles specialists, department leads, and computer-enabled agents.*

Read this page before delegating a task, designing a new agent, or adding a tool pack. The goal is not merely to call another model. The goal is to give a specialist enough context, authority, and boundaries to produce work that can be trusted and handed back cleanly.

---

## Core Principles

1. **Delegate outcomes, not vague topics.** A child agent receives a concrete result to produce, a deadline or stopping condition, and the evidence required to support it.
2. **The child does not inherit conversation history.** The parent must pass the relevant user goal, constraints, prior decisions, artifact IDs, attachments, and known facts in the task packet.
3. **Least privilege is the default.** Give an agent only the tool packs and external accounts required for the task. Reading email is not permission to send email; browsing is not permission to purchase or publish.
4. **The department lead owns quality.** When routing goes through a lead, the lead assigns specialists, resolves conflicts, checks the work, and returns one synthesis rather than a pile of raw outputs.
5. **Evidence beats confidence.** Record source URLs, message IDs, document IDs, command output, screenshots, or explicit “not verified” markers.
6. **Persistence is deliberate.** Save durable facts to memory or the knowledge graph only when confirmed. Save project files to the user's persistent sandbox, not an ephemeral process directory.
7. **Irreversible actions require a gate.** Sending, posting, paying, deleting, changing production infrastructure, or submitting a form needs approval unless the user explicitly granted a narrowly scoped standing authorization.

## Delegation Packet

Every delegation should contain these fields, in this order:

| Field | What to include |
|---|---|
| **Objective** | One sentence describing the user-visible outcome. |
| **Context** | Relevant people, company, project, dates, prior decisions, and why the task matters. |
| **Inputs** | URLs, artifact/document IDs, files, screenshots, email subjects, calendar event IDs, or data ranges. |
| **Constraints** | Budget, tone, geography, compliance, deadline, format, tools allowed, and things explicitly forbidden. |
| **Authority** | Read-only, draft-only, or execute-with-approval. State which actions are not authorized. |
| **Definition of done** | A checklist that can be verified without guessing. |
| **Handoff format** | The exact structure expected in the result. |
| **Escalation rule** | What uncertainty, risk, missing access, or contradiction must be reported to the parent. |

### Good delegation

```text
Objective: Prepare a decision-ready summary of the last 3 business days of inbox activity and today's calendar.
Context: The user is preparing for the Accra walk-in outreach campaign for ZiloShift.
Inputs: Search Gmail for the user's connected account; read today's calendar; do not open unrelated private threads.
Constraints: Read-only. Do not reply, archive, label, or create events. Use Europe/London for dates and Accra for campaign references.
Done when: Every urgent item has sender, subject, reason for urgency, deadline, and recommended next action; calendar conflicts are listed.
Handoff: Executive summary, urgent items, calendar, recommended actions, sources, blockers.
Escalate: Missing connection, ambiguous identity, sensitive content, or any action that would change external state.
```

### Weak delegation

```text
Check my emails and tell me what matters.
```

It lacks a time window, account scope, privacy boundary, output shape, and authority level.

## Child Agent Operating Loop

1. **Read context before tools.** Inspect the task packet, relevant memory, knowledge graph entities, department memory, and attached artifacts.
2. **Confirm the route.** Check that the selected agent and department actually match the task. If not, recommend a specialist or escalate to the department lead.
3. **Check access.** Verify the required Composio connection, sandbox, browser session, artifact, or cloud credential before attempting work. If unavailable, report the exact connection needed and continue with safe partial work where possible.
4. **Plan the smallest useful sequence.** Prefer a few observable tool calls over broad exploration. Parallelize independent research; serialize actions with dependencies.
5. **Separate facts, inference, and recommendation.** Never present an inferred value as a retrieved fact.
6. **Preserve evidence.** Include source links, IDs, timestamps, filenames, screenshots, or command output in the handoff.
7. **Stop at the authority boundary.** Draft first for external communication. Pause for approval before sending, publishing, purchasing, deleting, or changing production systems.
8. **Write confirmed learning.** Save only explicit user preferences, verified facts, durable project decisions, or confirmed outcomes. Never store raw secrets or unnecessary private content.
9. **Return a structured handoff.** Use the result contract below even when the task fails.

## Handoff Contract

Every child result should contain:

```markdown
## Result
[One-paragraph answer to the objective]

## Completed
- [Concrete work completed]

## Evidence
- [Source, artifact ID, file, tool result, or timestamp]

## Decisions And Assumptions
- Decision: [what was chosen and why]
- Assumption: [what was not verified]

## Blockers And Risks
- [Missing connection, conflicting data, approval required, or no blockers]

## Recommended Next Action
[One clear next move for the parent or user]

## Lead Review
- Required: yes/no
- Reason: [risk, uncertainty, cross-department impact, or no review needed]
```

A timeout or partial result must say what was completed, what was not attempted, and whether the evidence is stale. Never report a successful action when only a draft was produced.

## Tool And Access Policy

| Capability | Default | Required guardrail |
|---|---|---|
| Memory / knowledge graph | Read relevant context; write confirmed learning | Do not infer sensitive traits or overwrite confirmed facts silently |
| Gmail / calendar / SaaS via Composio | Read only unless explicitly authorized | Check connection first; distinguish account and workspace |
| Persistent sandbox | Use for files, repos, scripts, and long-running processes | Per-user isolation; user-scoped sandbox lookup; no secrets in output |
| Browser automation | Use an isolated profile/session | Never reuse another user's cookies; show login/approval boundary; avoid exposing tokens |
| Oracle / cloud SSH | Diagnostics and deployment only when scoped | Verify host and environment; no destructive commands without approval |
| Email, social, payments, deletion | Draft by default | Approval or narrow standing authorization before execution |
| Child-agent spawning | Use for specialization or parallel work | Pass complete context; cap depth and steps; synthesize results |

### Connections

If a needed integration is disconnected:

1. Say which capability is unavailable.
2. Explain the concrete benefit of connecting it.
3. Provide the connection flow or ask the parent to surface it.
4. Skip that source rather than fabricating a result.

## Agent Computer Model

Etles should treat a user's computer as a **persistent, isolated workspace**, not as unrestricted access to a server:

```text
User identity
    |
    +-- Persistent sandbox (files, repos, packages, sessions)
    |       +-- workspace/      active task files
    |       +-- projects/       long-lived repositories
    |       +-- .etles/        manifests, logs, preferences
    |
    +-- Browser profile/session (cookies isolated per user and purpose)
    |
    +-- Connected apps (OAuth/Composio, least privilege)
    |
    +-- External compute (Oracle/Daytona/E2B) through audited tools
```

The implementation should use these layers:

1. **Workspace identity:** one sandbox record per user, with ownership checks on every tool call.
2. **Filesystem:** stable directories for incoming files, active work, exports, and archives. Store large artifacts in object storage and keep metadata in Postgres.
3. **Process sessions:** persistent named sessions for servers, agents, and long jobs. Return status, logs, exit code, and a resumable session ID.
4. **Browser profiles:** one encrypted profile per user and purpose, with explicit login handoff. Persist cookies only in the isolated browser service; never put them in chat, memory, or source files.
5. **App connections:** OAuth tokens remain in the connection provider. Tools receive scoped access through Composio or the provider API, not raw tokens.
6. **Audit and approvals:** log who requested the action, which agent acted, which tool ran, what changed, and whether approval was required.
7. **Lifecycle:** start on demand, pause or stop when idle, keep files after stop, and run a keep-alive only for users who enabled the feature. Deletion must be explicit.

## Failure Modes And Fixes

| Failure | Cause | Fix |
|---|---|---|
| Child returns generic advice | Task packet lacks inputs and done criteria | Re-delegate with IDs, dates, constraints, and output schema |
| Parent cannot use the result | Free-form result has no evidence or structure | Require the handoff contract |
| Agent claims an email was sent | Draft and execute authority were mixed | Separate compose from send and add approval |
| Browser logs out every session | Ephemeral browser profile | Use a user-scoped persistent profile with encrypted storage |
| Agent sees another user's files | Sandbox or tool lookup lacks ownership check | Resolve resources by both user ID and resource ID; audit denied access |
| Long task disappears | Inline execution or non-durable process | Use workflow/task records, named sessions, heartbeats, retries, and resumable IDs |
| Memory becomes noisy | Agent stores every observation | Store only confirmed durable facts and explicit learning signals |
| Specialists contradict each other | No lead synthesis | Route through the department lead and require conflict resolution |

## Quick Reference

- Send objective, context, inputs, constraints, authority, done criteria, handoff format, and escalation rule.
- Assume the child has no conversation history.
- Check connections and ownership before using files, apps, browsers, or sandboxes.
- Draft external actions; obtain approval before execution.
- Preserve evidence and label assumptions.
- Use persistent sandbox files for work; use object storage for large durable artifacts.
- Keep browser cookies isolated and encrypted; never store secrets in memory or chat.
- Use durable workflows for long jobs and return resumable IDs.
- Make department leads synthesize specialist results.
- A partial, honest handoff is better than a confident invented completion.

---
*Page last updated: 2026-08-13 | Related pages: instructions, coding-craft, document*
