# Presentation
*Use this page when creating, editing, or exporting a slide deck, especially when the user asks for PowerPoint-level structure, visuals, charts, or generated images.*

---

## Quality Bar
- Build a narrative, not a stack of paragraphs: opening context, tension or insight, evidence, implication, action, close.
- Every slide has one dominant idea and one visual role. Use an image, chart, table, comparison, timeline, callout, or meaningful shape; never add invented data or decorative placeholder charts.
- Use safe contrast and generous space. Titles should be short enough to scan; body copy should be readable at presentation distance.
- Vary layouts intentionally: `narrative`, `split`, `image-led`, `chart-led`, `comparison`, and `closing`.

## Image Workflow
1. Decide whether a real visual improves comprehension. Do not generate an image merely to fill empty space.
2. For a requested or useful original visual, call `generateImage` first with a specific subject, composition, audience, and `16:9` or `3:2` aspect ratio.
3. Read the returned `url`. It is the public, persistent image URL, not the transient base64 preview.
4. Pass it to `createPresentation` in `visuals[].url` and place the exact URL in the target slide's `imageUrl`.
5. Give the image useful `alt` text and use `image-led` or `split` layout. If the image fails to load, retain the slide's textual meaning.

## Slide Blueprint
| Slide | Purpose | Preferred treatment |
|---|---|---|
| Opening | Name the subject and promise | `closing`-like hero, short subtitle, strong visual |
| Problem | Make the cost or tension concrete | split text and evidence, no vague claims |
| Insight | Explain the mechanism | diagram-like bullets, comparison, or image-led |
| Evidence | Show sourced data | `chart-led`, native chart, clear units and date |
| Options | Help decide | comparison table or two-column trade-off |
| Plan | Make action executable | timeline, numbered steps, owners, dates |
| Close | Leave one memorable action | concise statement, next step, supporting visual |

## Structured Output
Return only valid JSON:
```json
{
  "theme": "ocean",
  "slides": [{
    "title": "One clear idea",
    "body": "Markdown-compatible supporting explanation.",
    "bullets": ["Evidence-backed point", "Decision implication"],
    "layout": "split",
    "imageUrl": "https://...",
    "visual": "What the visual communicates",
    "chart": {"chartType":"line","labels":["Jan","Feb"],"series":[{"name":"Revenue","data":[10,14]}]},
    "table": {"headers":["Option","Trade-off"],"rows":[["A","Fast"]]},
    "notes": "Speaker-only context and delivery guidance."
  }]
}
```
Use tables for comparison, charts for numeric relationships, and Markdown only for readable inline emphasis, lists, and short blocks. Keep chart labels and series lengths aligned.

## Failure Modes
- **Raw JSON shown to the user:** validate the envelope and recover double-encoded JSON before rendering.
- **Text disappears:** remove low-contrast muted text, avoid dark-on-dark body copy, and keep a readable max width.
- **Every slide looks identical:** assign layouts according to purpose; do not use narrative for every slide.
- **Broken image:** hide only the failed image, preserve alt text or a visual description, and never block the deck.
- **PPTX opens incorrectly:** use native charts/tables, safe fonts such as Arial or Cambria, valid hex colors without `#`, and fit text within bounds.
- **Invented visuals or metrics:** omit unsupported data and say what source is missing instead of fabricating it.

## Quick Reference
- Use `generateImage` before `createPresentation` when an original visual is needed.
- Exact generated URL goes in `imageUrl`.
- One idea per slide; one dominant visual role.
- Use native chart specs and real source data.
- Add speaker notes when delivery context matters.
- Verify both the in-app preview and downloaded `.pptx`.

---
*Page last updated: 2026-08-16 | Related pages: document, content-creation, research*
