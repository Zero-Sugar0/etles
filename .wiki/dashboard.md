# Dashboard
*Use this page when creating or editing an evidence-based operating dashboard with KPIs, charts, filters, insights, and detail data.*

---

## Quality Bar
- A dashboard is for decisions, not decoration. Every metric must have a source, unit, date range, and interpretation.
- Do not invent KPI values, chart series, trends, or rows when source data is absent. Omit unsupported sections and explain the gap.
- Lead with a small KPI set, then show trends, breakdowns, insights, and the detail table that lets a user verify the story.
- Design for scanning: strong contrast, short labels, readable tables, responsive charts, and filters that change the displayed view.

## Structured Output
Return only valid JSON:
```json
{
  "title":"Pipeline health",
  "eyebrow":"Sales operations",
  "description":"Weekly view of qualified pipeline.",
  "dateRange":"2026-08-10 to 2026-08-16",
  "filters":[{"label":"Region","options":["All","Accra"],"value":"All"}],
  "kpis":[{"label":"Qualified leads","value":42,"change":"+12%","target":"50","status":"positive","description":"Verified this week"}],
  "charts":[{"chartType":"line","title":"Qualified leads by day","labels":["Mon","Tue"],"series":[{"name":"Leads","data":[5,8]}]}],
  "insights":[{"title":"Momentum","body":"Lead volume is rising after the outreach block.","tone":"positive"}],
  "rows":[{"company":"Example Co","status":"Qualified","owner":"Amina","updated":"2026-08-16"}]
}
```

## Dashboard Method
1. Identify the decision the dashboard should support.
2. Confirm source data, date range, units, and refresh time.
3. Select only the KPIs that answer the decision directly.
4. Use line or area charts for change over time, bar charts for comparisons, pie/radial only for a small composition, and tables for auditability.
5. Add filters only when they alter a real data slice; do not add decorative controls.
6. Write insights as observations plus implications, not unsupported predictions.
7. Keep detail rows consistent so CSV export and mobile tables remain useful.

## Failure Modes
- **Mock dashboard:** remove sample values and empty chart scaffolding; use a truthful empty state.
- **Unreadable text:** increase contrast, wrap labels, allow horizontal table scrolling, and avoid tiny chart labels.
- **Chart without context:** include title, units, date labels, and a legend when multiple series exist.
- **Filters that do nothing:** omit them or connect them to actual displayed data.
- **KPI overload:** prefer four to six high-signal cards and move supporting measures into charts or rows.

## Quick Reference
- Use `createDashboard` for structured dashboard JSON.
- Use real source data only.
- Keep values, labels, and series lengths aligned.
- Include date range and units.
- Detail rows should have stable columns.
- Verify desktop, mobile, empty, and filtered states.

---
*Page last updated: 2026-08-16 | Related pages: document, research, instructions*
