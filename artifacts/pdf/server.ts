import { smoothStream, streamText } from "ai";
import { pdfPrompt } from "@/lib/ai/prompts";
import { getArtifactModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

function withPdfThemeComment(content: string, data: unknown) {
  if (/<!--\s*pdf-theme:/i.test(content)) {
    return content;
  }
  const requested =
    data && typeof data === "object"
      ? (data as { theme?: unknown }).theme
      : undefined;
  const allowed = new Set([
    "slate",
    "ocean",
    "cobalt",
    "forest",
    "plum",
    "terracotta",
  ]);
  const theme =
    typeof requested === "string" && allowed.has(requested)
      ? requested
      : "slate";
  return `<!-- pdf-theme: ${JSON.stringify({ theme })} -->\n\n${content}`;
}

const run = async ({ prompt, data, dataStream, modelId, type }: any) => {
  const result = streamText({
    model: getArtifactModel(modelId),
    system: pdfPrompt,
    prompt,
    experimental_transform: smoothStream({ chunking: "word" }),
  });
  let content = "";
  for await (const delta of result.textStream) {
    content += delta;
    dataStream.write({
      type: `data-${type}Delta`,
      data: delta,
      transient: true,
    });
  }
  return type === "pdf" ? withPdfThemeComment(content, data) : content;
};
export const pdfDocumentHandler = createDocumentHandler({
  kind: "pdf",
  onCreateDocument: (args) =>
    run({
      ...args,
      type: "pdf",
      prompt: `Create a downloadable, print-ready Letter-size PDF document titled "${args.title}".
Audience: ${args.audience ?? "professional decision makers"}
Style: ${args.style ?? "editorial research report with disciplined typography and information-dense exhibits"}
Source data: ${JSON.stringify(args.data ?? {})}

Design the document like a real authored PDF, not a chat transcript:
- Establish a cover/title treatment, running hierarchy, section headings, page rhythm, and a clear closing source note.
- Use concise paragraphs, intentional whitespace, bold lead-ins, bullets, tables, blockquotes, and exhibits. Prefer two-column exhibit sections only when the content genuinely benefits from comparison.
- Use Markdown tables for structured data. Keep table cells concise enough to wrap cleanly on Letter pages.
- Use fenced JSON chart specs when a chart is materially useful: {"title":"...","labels":["..."],"series":[{"name":"...","data":[1,2,3]}]}.
- Use Markdown image URLs for relevant visuals and place an italic source/caption directly below each image.
- Use blockquotes for callout panels and label them with a short bold lead-in.
- Never emit raw HTML, inline CSS, or hard-coded color values. Choose one semantic theme from: slate, ocean, cobalt, forest, plum, terracotta. Emit exactly one metadata comment at the top: <!-- pdf-theme: {"theme":"slate"} -->.
- Do not invent citations, sources, figures, or images. Keep the document truthful and structured for both screen preview and PDF export.`,
    }),
  onUpdateDocument: (args) =>
    run({
      ...args,
      type: "pdf",
      prompt: `${args.description}\n\nImprove this existing PDF content while preserving supported facts and structure. Keep rich Markdown, tables, chart fences, and image URLs usable:\n\n${args.document.content}`,
    }),
});
