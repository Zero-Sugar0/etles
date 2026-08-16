# Planner
*Use this page when creating or editing an actionable planner, schedule, roadmap, or operating cadence.*

---

## Quality Bar
- A planner must answer what happens, when, who owns it, why it matters, and what completion means.
- Use real dates from the request or current date context. Never populate empty rows with fake tasks.
- Sequence work around dependencies, deadlines, buffers, and recovery time rather than filling every hour.
- Keep the planner editable: events, goals, priorities, notes, and completion state must be represented as structured fields.

## Structured Output
Return only valid JSON:
```json
{
  "title":"Launch week",
  "description":"A focused operating plan.",
  "period":"2026-08-17 to 2026-08-23",
  "startDate":"2026-08-17",
  "goals":["Ship the launch"],
  "events":[{
    "id":"launch-brief",
    "date":"2026-08-17",
    "title":"Finalize launch brief",
    "time":"09:00",
    "endTime":"10:30",
    "tag":"Strategy",
    "priority":"high",
    "status":"planned",
    "completed":false,
    "location":"Workspace",
    "notes":"## Definition of done\n- Approved positioning\n- Owner assigned"
  }]
}
```

## Planning Method
1. Extract the outcome, deadline, constraints, and known commitments.
2. Define one to three measurable goals.
3. Break each goal into milestones and concrete events.
4. Put dependencies before dependent work and add buffers before hard deadlines.
5. Mark priority, status, owner or location, and definition-of-done notes.
6. Keep notes rich but concise: Markdown headings, bullets, checklists, and tables are allowed.

## Failure Modes
- **Blank planner:** do not return a generic Task row; render the description and goals and ask for missing dates only when necessary.
- **Unusable schedule:** avoid overlapping events unless overlap is intentional and explain it.
- **No progress signal:** include `completed`, `status`, and a clear next action.
- **Stale plan:** preserve dates and show the period explicitly when editing an existing planner.
- **Object rendered as text:** normalize event titles, notes, and bullet values to strings before rendering.

## Quick Reference
- Dates use `YYYY-MM-DD`; times use 24-hour format.
- Events are editable and deletable.
- Notes support rich Markdown.
- Include dependencies and buffers for meaningful work.
- Omit unsupported assumptions.

---
*Page last updated: 2026-08-16 | Related pages: document, instructions*
