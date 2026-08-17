import pptxgen from "pptxgenjs";

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Etles";
pptx.company = "Etles";
pptx.subject = "Etles platform overview";
pptx.title = "Etles — The Autonomous AI Operator";
pptx.lang = "en-US" as never;

const C = {
  ink: "17202A",
  paper: "F7F8FA",
  panel: "FFFFFF",
  slate: "596575",
  line: "D8DEE7",
  teal: "0F766E",
  mint: "DDF4EF",
  coral: "E76F51",
  yellow: "F2C14E",
  lilac: "E9E1F8",
  violet: "6D5BD0",
  blue: "2E6F95",
};

const W = 13.333;
const H = 7.5;

function addBase(slide: pptxgen.Slide, section: string, number: number, dark = false) {
  slide.background = { color: dark ? C.ink : C.paper };
  slide.addText(section.toUpperCase(), {
    x: 0.55, y: 0.32, w: 3.6, h: 0.2, fontFace: "Arial", fontSize: 8,
    bold: true, charSpacing: 1.4, color: dark ? "AFC3D4" : C.slate, margin: 0,
  });
  slide.addText(`ETLES  /  ${String(number).padStart(2, "0")}`, {
    x: 10.85, y: 0.32, w: 1.95, h: 0.2, fontFace: "Arial", fontSize: 8,
    bold: true, charSpacing: 1.1, align: "right", color: dark ? "AFC3D4" : C.slate, margin: 0,
  });
  slide.addShape(pptx.ShapeType.line, { x: 0.55, y: 0.68, w: 12.2, h: 0, line: { color: dark ? "385062" : C.line, pt: 0.7 } });
  slide.addText("ETLES", { x: 0.55, y: 7.15, w: 1, h: 0.15, fontFace: "Arial", fontSize: 8, bold: true, color: dark ? "7694A8" : C.slate, margin: 0 });
  slide.addText("Autonomous operations, with memory", { x: 8.7, y: 7.15, w: 4.05, h: 0.15, fontFace: "Arial", fontSize: 8, align: "right", color: dark ? "7694A8" : C.slate, margin: 0 });
}

function title(slide: pptxgen.Slide, text: string, subtitle?: string, dark = false) {
  slide.addText(text, { x: 0.75, y: 1.02, w: 8.8, h: 0.7, fontFace: "Cambria", fontSize: 28, bold: true, color: dark ? "FFFFFF" : C.ink, margin: 0, fit: "shrink" });
  if (subtitle) slide.addText(subtitle, { x: 0.78, y: 1.82, w: 8.8, h: 0.42, fontFace: "Arial", fontSize: 13, color: dark ? "C4D2DC" : C.slate, margin: 0, breakLine: false, fit: "shrink" });
}

function card(slide: pptxgen.Slide, x: number, y: number, w: number, h: number, heading: string, body: string, accent = C.teal, dark = false) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: dark ? "223340" : C.panel }, line: { color: dark ? "385062" : C.line, pt: 0.8 } });
  slide.addShape(pptx.ShapeType.ellipse, { x: x + 0.22, y: y + 0.22, w: 0.24, h: 0.24, fill: { color: accent }, line: { color: accent, transparency: 100 } });
  slide.addText(heading, { x: x + 0.6, y: y + 0.2, w: w - 0.82, h: 0.3, fontFace: "Arial", fontSize: 13, bold: true, color: dark ? "FFFFFF" : C.ink, margin: 0, fit: "shrink" });
  slide.addText(body, { x: x + 0.25, y: y + 0.7, w: w - 0.5, h: h - 0.9, fontFace: "Arial", fontSize: 10.5, color: dark ? "C4D2DC" : C.slate, breakLine: false, fit: "shrink", margin: 0.02, valign: "top" });
}

function pill(slide: pptxgen.Slide, text: string, x: number, y: number, color: string, fill: string) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w: text.length * 0.075 + 0.45, h: 0.32, rectRadius: 0.08, fill: { color: fill }, line: { color: fill, transparency: 100 } });
  slide.addText(text, { x: x + 0.12, y: y + 0.085, w: text.length * 0.075 + 0.2, h: 0.12, fontFace: "Arial", fontSize: 8.5, bold: true, color, margin: 0, align: "center" });
}

async function main() {

// 1. Cover
{
  const slide = pptx.addSlide();
  addBase(slide, "Platform overview", 1, true);
  slide.addShape(pptx.ShapeType.arc, { x: 8.45, y: -0.4, w: 5.3, h: 5.3, adjustPoint: 0.25, line: { color: C.teal, pt: 2, transparency: 15 }, fill: { color: C.ink, transparency: 100 } });
  slide.addShape(pptx.ShapeType.arc, { x: 9.2, y: 1.9, w: 4.2, h: 4.2, adjustPoint: 0.2, line: { color: C.coral, pt: 1.4, transparency: 10 }, fill: { color: C.ink, transparency: 100 } });
  slide.addShape(pptx.ShapeType.ellipse, { x: 10.55, y: 2.85, w: 1.2, h: 1.2, fill: { color: C.yellow, transparency: 12 }, line: { color: C.yellow, transparency: 100 } });
  pill(slide, "PRODUCT BUILD  /  2026", 0.8, 1.2, C.ink, C.yellow);
  slide.addText("Etles", { x: 0.75, y: 2.0, w: 5.2, h: 0.75, fontFace: "Cambria", fontSize: 42, bold: true, color: "FFFFFF", margin: 0 });
  slide.addText("The autonomous AI operator", { x: 0.78, y: 2.95, w: 7.2, h: 0.62, fontFace: "Cambria", fontSize: 28, color: "DCE9F0", margin: 0 });
  slide.addText("A persistent agent that remembers context, uses real tools, creates working artifacts, and coordinates execution across channels.", { x: 0.82, y: 4.05, w: 5.9, h: 0.9, fontFace: "Arial", fontSize: 16, color: "B8CAD5", breakLine: false, fit: "shrink", margin: 0 });
  slide.addText("Built around action, not just answers.", { x: 0.82, y: 5.55, w: 4.7, h: 0.28, fontFace: "Arial", fontSize: 11, bold: true, color: C.yellow, margin: 0 });
}

// 2. Product thesis
{
  const slide = pptx.addSlide();
  addBase(slide, "The product", 2);
  title(slide, "From chat window to operating system", "Etles connects conversation, durable execution, memory, and artifacts in one working loop.");
  card(slide, 0.8, 2.65, 2.8, 2.1, "Understand", "Conversation, goals, calendar, email, memory, and the user’s operating context.", C.blue);
  card(slide, 3.85, 2.65, 2.8, 2.1, "Decide", "Reasoning models, planning, knowledge graph, sub-agents, and approval policies.", C.violet);
  card(slide, 6.9, 2.65, 2.8, 2.1, "Act", "Composio, cloud tools, browser sessions, sandbox execution, and durable workflows.", C.coral);
  card(slide, 9.95, 2.65, 2.55, 2.1, "Return", "Editable text, code, dashboards, planners, reports, PDFs, images, and decks.", C.teal);
  slide.addShape(pptx.ShapeType.chevron, { x: 3.53, y: 3.35, w: 0.32, h: 0.45, fill: { color: C.line }, line: { color: C.line, transparency: 100 } });
  slide.addShape(pptx.ShapeType.chevron, { x: 6.58, y: 3.35, w: 0.32, h: 0.45, fill: { color: C.line }, line: { color: C.line, transparency: 100 } });
  slide.addShape(pptx.ShapeType.chevron, { x: 9.63, y: 3.35, w: 0.32, h: 0.45, fill: { color: C.line }, line: { color: C.line, transparency: 100 } });
  slide.addText("The differentiator is continuity: the next action begins with the context the last action created.", { x: 1.05, y: 5.55, w: 11.1, h: 0.55, fontFace: "Cambria", italic: true, fontSize: 18, color: C.ink, align: "center", margin: 0 });
}

// 3. Artifact studio
{
  const slide = pptx.addSlide();
  addBase(slide, "Artifact studio", 3);
  title(slide, "Work comes back as something you can use", "Every output is persisted, editable, and designed for the medium it belongs to.");
  const artifacts = [
    ["Text", "Rich Markdown, tables, lists, emphasis, and versioned editing.", C.teal],
    ["Code", "Runnable code, previews, diagnostics, and persistent sandbox workflows.", C.blue],
    ["Dashboard", "KPI cards, filters, charts, insights, and detail tables.", C.violet],
    ["Planner", "Events, priorities, deadlines, buffers, and interactive updates.", C.coral],
    ["Presentation", "16:9 slides, images, cards, charts, notes, and PPTX export.", C.yellow],
    ["PDF / Report", "Pages, typography, themes, tables, charts, and print-ready export.", C.teal],
  ] as const;
  artifacts.forEach(([name, body, accent], i) => card(slide, 0.8 + (i % 3) * 4.1, 2.55 + Math.floor(i / 3) * 1.8, 3.65, 1.42, name, body, accent));
  slide.addText("One agent. Multiple working surfaces.", { x: 0.85, y: 6.35, w: 5.8, h: 0.3, fontFace: "Arial", fontSize: 12, bold: true, color: C.slate, margin: 0 });
}

// 4. Presentation-specific upgrade
{
  const slide = pptx.addSlide();
  addBase(slide, "Presentation studio", 4, true);
  title(slide, "A deck, not a text dump", "The presentation renderer now understands composition: hero, split, card-grid, chart-led, comparison, timeline, and closing layouts.", true);
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.85, y: 2.65, w: 6.6, h: 3.45, rectRadius: 0.08, fill: { color: "FFFFFF" }, line: { color: "FFFFFF", transparency: 100 } });
  slide.addText("THE PROBLEM", { x: 1.2, y: 3.0, w: 1.4, h: 0.18, fontFace: "Arial", fontSize: 8, bold: true, color: C.violet, charSpacing: 1.2, margin: 0 });
  slide.addText("Slides carry the argument.", { x: 1.2, y: 3.35, w: 4.8, h: 0.55, fontFace: "Cambria", fontSize: 25, bold: true, color: C.ink, margin: 0 });
  slide.addShape(pptx.ShapeType.roundRect, { x: 1.2, y: 4.35, w: 2.8, h: 1.1, rectRadius: 0.05, fill: { color: C.lilac }, line: { color: C.lilac, transparency: 100 } });
  slide.addText("01\nOne dominant idea", { x: 1.45, y: 4.62, w: 1.9, h: 0.45, fontFace: "Arial", fontSize: 12, bold: true, color: C.ink, margin: 0, breakLine: false });
  slide.addShape(pptx.ShapeType.roundRect, { x: 4.25, y: 4.35, w: 2.8, h: 1.1, rectRadius: 0.05, fill: { color: C.mint }, line: { color: C.mint, transparency: 100 } });
  slide.addText("02\nVisual evidence", { x: 4.5, y: 4.62, w: 1.9, h: 0.45, fontFace: "Arial", fontSize: 12, bold: true, color: C.ink, margin: 0, breakLine: false });
  card(slide, 8.0, 2.65, 4.35, 1.35, "Generated imagery", "Call generateImage first, then place the exact persistent URL into the slide. Use full for background composition.", C.coral, true);
  card(slide, 8.0, 4.25, 4.35, 1.35, "Data surfaces", "Charts and tables stay native, theme-aware, readable, and exportable to PowerPoint.", C.yellow, true);
}

// 5. Agent architecture
{
  const slide = pptx.addSlide();
  addBase(slide, "Agent architecture", 5);
  title(slide, "Memory gives the operator continuity", "The system combines short-term conversation, durable memories, structured knowledge, and explicit goals.");
  const nodes = [
    ["Conversation", 0.9, 3.0, C.blue],
    ["Memory", 3.25, 2.05, C.teal],
    ["Knowledge graph", 3.25, 4.0, C.violet],
    ["Goals + plans", 6.1, 2.05, C.coral],
    ["Heartbeats", 6.1, 4.0, C.yellow],
    ["Action tools", 9.0, 3.0, C.teal],
  ] as const;
  nodes.forEach(([label, x, y, color]) => {
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w: 2.05, h: 0.82, rectRadius: 0.06, fill: { color: "FFFFFF" }, line: { color, pt: 1.4 } });
    slide.addText(label, { x: x + 0.15, y: y + 0.29, w: 1.75, h: 0.2, fontFace: "Arial", fontSize: 11, bold: true, color: C.ink, align: "center", margin: 0, fit: "shrink" });
  });
  [[2.95, 3.4, 3.2, 2.45], [5.3, 2.45, 6.0, 3.35], [5.3, 4.4, 6.0, 3.35], [8.15, 3.4, 8.9, 3.4]].forEach(([x1, y1, x2, y2]) => slide.addShape(pptx.ShapeType.line, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color: C.line, pt: 1.4, beginArrowType: "none", endArrowType: "triangle" } }));
  slide.addText("The agent does not start from zero every time. It can recall what mattered, when it mattered, and what should happen next.", { x: 1.1, y: 6.15, w: 11.05, h: 0.42, fontFace: "Cambria", italic: true, fontSize: 16, color: C.slate, align: "center", margin: 0 });
}

// 6. Tools and channels
{
  const slide = pptx.addSlide();
  addBase(slide, "Connected execution", 6, true);
  title(slide, "The agent can leave the chat", "Composio, browser sessions, cloud tools, sandboxes, and messaging adapters make the work operational.", true);
  const channels = ["Web chat", "Slack", "WhatsApp", "Telegram", "Teams", "Google Chat", "Discord", "iMessage / SMS"];
  channels.forEach((name, i) => {
    const x = 0.9 + (i % 4) * 3.05;
    const y = 2.7 + Math.floor(i / 4) * 1.15;
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w: 2.65, h: 0.72, rectRadius: 0.06, fill: { color: "223340" }, line: { color: "385062", pt: 0.8 } });
    slide.addShape(pptx.ShapeType.ellipse, { x: x + 0.18, y: y + 0.22, w: 0.26, h: 0.26, fill: { color: [C.teal, C.coral, C.yellow, C.violet][i % 4] }, line: { color: "FFFFFF", transparency: 100 } });
    slide.addText(name, { x: x + 0.58, y: y + 0.25, w: 1.85, h: 0.2, fontFace: "Arial", fontSize: 11, bold: true, color: "FFFFFF", margin: 0, fit: "shrink" });
  });
  slide.addText("Credential handling is designed around encrypted profile secrets, environment-first resolution, and user-aware execution context.", { x: 1.0, y: 5.75, w: 11.2, h: 0.38, fontFace: "Arial", fontSize: 13, color: "C4D2DC", align: "center", margin: 0 });
}

// 7. Durable operations
{
  const slide = pptx.addSlide();
  addBase(slide, "Durable operations", 7);
  title(slide, "Execution keeps moving after the tab closes", "Workflows, QStash, approvals, retries, and dispatch state turn agent intent into durable operations.");
  const stages = [["Plan", "Mission and task created", C.blue], ["Review", "Human approval when needed", C.violet], ["Dispatch", "Provider-specific action", C.coral], ["Observe", "Status, receipts, retry state", C.teal]] as const;
  stages.forEach(([heading, body, color], i) => {
    const x = 0.85 + i * 3.05;
    slide.addShape(pptx.ShapeType.roundRect, { x, y: 2.85, w: 2.55, h: 1.55, rectRadius: 0.06, fill: { color: C.panel }, line: { color, pt: 1.5 } });
    slide.addText(`0${i + 1}`, { x: x + 0.2, y: 3.1, w: 0.35, h: 0.22, fontFace: "Arial", fontSize: 10, bold: true, color, margin: 0 });
    slide.addText(heading, { x: x + 0.65, y: 3.08, w: 1.55, h: 0.25, fontFace: "Arial", fontSize: 14, bold: true, color: C.ink, margin: 0 });
    slide.addText(body, { x: x + 0.2, y: 3.65, w: 2.1, h: 0.4, fontFace: "Arial", fontSize: 10.5, color: C.slate, margin: 0, fit: "shrink" });
    if (i < 3) slide.addShape(pptx.ShapeType.chevron, { x: x + 2.67, y: 3.38, w: 0.28, h: 0.4, fill: { color: C.line }, line: { color: C.line, transparency: 100 } });
  });
  slide.addText("Campaign approval now has a durable dispatcher with scheduled delivery, idempotency, retries, failure state, and provider execution paths.", { x: 1.1, y: 5.35, w: 11.0, h: 0.6, fontFace: "Cambria", fontSize: 18, italic: true, color: C.ink, align: "center", margin: 0, fit: "shrink" });
}

// 8. Team tenancy and security
{
  const slide = pptx.addSlide();
  addBase(slide, "Trust and tenancy", 8, true);
  title(slide, "From personal operator to team system", "Workspaces, memberships, selected context, encrypted secrets, and ownership checks establish the team boundary.", true);
  card(slide, 0.9, 2.6, 3.55, 2.2, "Workspace boundary", "Workspaces and memberships\nOwner / admin / member / viewer roles\nSelected workspace context", C.teal, true);
  card(slide, 4.9, 2.6, 3.55, 2.2, "Protected execution", "User-aware credential resolution\nEnvironment-first BYOK fallback\nStrict ownership checks", C.coral, true);
  card(slide, 8.9, 2.6, 3.55, 2.2, "Operational controls", "Approval gates\nQStash signatures\nIdempotent task transitions", C.yellow, true);
  slide.addText("The core team-tenancy layer is implemented and tested; broader workspace ownership for every resource is the next expansion surface.", { x: 1.0, y: 5.6, w: 11.3, h: 0.45, fontFace: "Arial", fontSize: 13, color: "C4D2DC", align: "center", margin: 0 });
}

// 9. Close / roadmap
{
  const slide = pptx.addSlide();
  addBase(slide, "Next horizon", 9);
  title(slide, "The next layer is scale, not a blank slate", "Etles already has the operating loop. The next work expands team governance and broadens workspace ownership.");
  const roadmap = [
    ["Now", "Persistent artifacts, tools, memory, workflows, workspace core", C.teal],
    ["Next", "Workspace-scoped integrations, invitations, audit log, granular policies", C.violet],
    ["Then", "Quotas, shared knowledge, department agents, richer cross-channel continuity", C.coral],
  ] as const;
  roadmap.forEach(([label, body, color], i) => {
    const y = 2.65 + i * 1.1;
    slide.addShape(pptx.ShapeType.ellipse, { x: 1.0, y: y + 0.08, w: 0.34, h: 0.34, fill: { color }, line: { color, transparency: 100 } });
    if (i < 2) slide.addShape(pptx.ShapeType.line, { x: 1.17, y: y + 0.42, w: 0, h: 0.75, line: { color: C.line, pt: 1.4 } });
    slide.addText(label, { x: 1.65, y, w: 1.0, h: 0.28, fontFace: "Arial", fontSize: 13, bold: true, color, margin: 0 });
    slide.addText(body, { x: 2.8, y, w: 8.8, h: 0.32, fontFace: "Arial", fontSize: 14, color: C.ink, margin: 0, fit: "shrink" });
  });
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.95, y: 6.0, w: 11.35, h: 0.62, rectRadius: 0.06, fill: { color: C.ink }, line: { color: C.ink, transparency: 100 } });
  slide.addText("Etles is being built as a system that can remember, decide, act, and leave useful work behind.", { x: 1.25, y: 6.2, w: 10.75, h: 0.2, fontFace: "Cambria", fontSize: 15, italic: true, color: "FFFFFF", align: "center", margin: 0 });
}

  await pptx.writeFile({ fileName: "Etles-Platform-Overview.pptx" });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
