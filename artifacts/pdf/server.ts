import { streamText } from "ai";
import { pdfPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

function withPdfThemeComment(content: string, data: unknown) {
  if (/<!--\s*pdf-theme:/i.test(content) || !data || typeof data !== "object") return content;
  const palette = (data as { palette?: Record<string, unknown> }).palette;
  const theme = (data as { theme?: string }).theme;
  const themeDefaults: Record<string, Record<string, string>> = {
    forest: { ink: "173f3a", accent: "efb39f", wash: "e3efe8", paper: "fffdf8", body: "29423c", muted: "66756e" },
    ocean: { ink: "174b63", accent: "63b4c7", wash: "e3f2f5", paper: "fafdff", body: "244455", muted: "617b88" },
    plum: { ink: "4d315d", accent: "d69ac5", wash: "f3e6f2", paper: "fffbff", body: "493950", muted: "786a7c" },
    cobalt: { ink: "23457a", accent: "f0b35f", wash: "e8eef9", paper: "fbfdff", body: "2f4260", muted: "687991" },
    terracotta: { ink: "703b32", accent: "e39a70", wash: "f8e9df", paper: "fffaf7", body: "543b34", muted: "826c63" },
    slate: { ink: "293943", accent: "7aa4a8", wash: "e7eef0", paper: "fbfcfc", body: "34464e", muted: "6e7d82" },
  };
  const source = palette && typeof palette === "object" ? palette : themeDefaults[theme ?? "slate"];
  if (!source) return content;
  const keys = ["ink", "accent", "wash", "paper", "body", "muted"] as const;
  const valid = keys.every((key) => typeof source[key] === "string" && /^[0-9a-f]{6}$/i.test(source[key] as string));
  if (!valid) return content;
  return `<!-- pdf-theme: ${JSON.stringify(Object.fromEntries(keys.map((key) => [key, source[key]])))} -->\n\n${content}`;
}

const run = async ({ prompt, data, dataStream, modelId, type }: any) => {
  const result = streamText({
    model: getLanguageModel(modelId ?? "google/gemini-2.5-flash"),
    system: pdfPrompt,
    prompt,
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
      prompt: `Create a downloadable PDF document titled "${args.title}".
Audience: ${args.audience ?? "professional decision makers"}
Style: ${args.style ?? "clear, editorial, print-ready"}
Source data: ${JSON.stringify(args.data ?? {})}
Use Markdown headings, emphasis, lists, tables, blockquotes, fenced chart specs, and Markdown image URLs when they improve comprehension. Keep the document truthful and structured for both screen preview and PDF export.`,
    }),
  onUpdateDocument: (args) =>
    run({
      ...args,
      type: "pdf",
      prompt: `${args.description}\n\nImprove this existing PDF content while preserving supported facts and structure. Keep rich Markdown, tables, chart fences, and image URLs usable:\n\n${args.document.content}`,
    }),
});
