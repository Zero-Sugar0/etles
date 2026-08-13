# Document Creation Guide

Etles creates saved artifacts through the document pipeline. The agent selects a dedicated tool, the server handler generates the content, the stream updates the open artifact, and the final document is persisted by ID. The chat result keeps that ID so the artifact can be reopened after closing.

## Shared Rules

- Use a dedicated creation tool for the requested artifact type.
- Put the user's complete brief in `prompt`, and pass `audience`, `style`, and structured `data` when available.
- Use `updateDocument` for later revisions instead of creating a second document in the same response.
- Generated content must be valid for the artifact's format before it is saved.
- Use theme tokens and the user's light/dark mode for presentation. Artifact-specific colors belong in the generated data, not in the component shell.

## Text And Reports

Text artifacts use Markdown and the text editor. Reports use Markdown with headings, lists, emphasis, links, tables, charts, Mermaid diagrams, and math where appropriate. Keep source content in Markdown so it remains editable, searchable, and exportable.

## Planner

Use `createPlanner` for schedules, calendars, timelines, and operating plans. Supply a clear title, period, start date, priorities, deadlines, buffers, and notes. The generated document should be valid JSON:

```json
{
  "description": "Short planning context",
  "events": [
    {"date":"2026-08-13","title":"Review leads","time":"09:00","tag":"Sales","priority":"high","notes":"Prepare the outreach list"}
  ]
}
```

Planner content must be persisted, reloadable, editable, and rendered with theme tokens. Do not use placeholder events when valid saved events exist.

## Dashboard

Use `createDashboard` for KPIs, operating metrics, comparisons, and decision views. Supply `kpis`, `rows`, `filters`, `dateRange`, and one or more chart specs. Chart specs use the shared chart renderer and support line, bar, area, pie, radar, scatter, composed, funnel, and radial charts.

```json
{
  "description":"Performance overview",
  "kpis":[{"label":"Revenue","value":"$84k","change":"+18%"}],
  "charts":[{"chartType":"line","title":"Revenue trend","labels":["Mon","Tue"],"series":[{"name":"Revenue","data":[120,180]}]}],
  "rows":[{"Channel":"Walk-in","Leads":150,"Won":24}],
  "filters":["Region","Owner"],
  "dateRange":"Last 30 days"
}
```

Dashboards must show useful empty states, readable tables, responsive charts, and the saved data. Never replace real chart data with decorative hardcoded bars.

## Presentation

Use `createPresentation` for a slide deck. If visuals are needed, call `generateImage` first and pass its returned public URL in `visuals[].url`. Use structured slides with a title, Markdown-compatible body, bullets, layout, notes, tables, charts, and optional `imageUrl`.

```json
{
  "slides":[
    {
      "title":"The opportunity",
      "body":"**Why now:** the market is moving.",
      "bullets":["Demand is rising","The team has a distribution edge"],
      "layout":"insight",
      "notes":"Explain the evidence and transition to the plan.",
      "chart":{"chartType":"bar","labels":["Q1","Q2"],"series":[{"name":"Growth","data":[20,35}]}
    }
  ]
}
```

Presentation rendering must preserve Markdown, tables, charts, and images. It must provide a loading state, persist edits, reopen from chat, and use the application's theme rather than forcing a midnight-green/beige palette.

## PDF

Use `createPdf` for print-ready reports, proposals, briefs, and contracts. Generate Markdown with a strong hierarchy, tables, lists, citations, callouts, and chart blocks. The PDF preview and export should use the same source content and selected theme.

## Spreadsheet

Use the sheet artifact for tabular workbooks. Return structured workbook JSON with a title, sheets, CSV data, optional cell styles, and a theme such as `editorial`, `ocean`, `forest`, `sunset`, `lavender`, or `midnight`. The grid must keep text readable, preserve formulas and styles, and save edits as document versions.

## Lifecycle Checklist

1. Create a document ID and stream `data-kind`, `data-id`, and `data-title`.
2. Stream the correct content delta for the artifact kind.
3. Save the final content in the document store.
4. Return the document ID, title, and kind in the tool result.
5. Keep a clickable result in the chat after the full-screen artifact closes.
6. Re-fetch the latest saved version before rendering a reopened artifact.
