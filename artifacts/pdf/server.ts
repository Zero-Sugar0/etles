import { streamText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

const run = async ({ prompt, dataStream, modelId, type }: any) => {
  const result = streamText({
    model: getLanguageModel(modelId ?? "google/gemini-2.5-flash"),
    system:
      "Create a polished, print-ready document with clear Markdown headings, tables when useful, accurate figures, and a premium editorial voice. Never invent legal or financial facts.",
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
  return content;
};
export const pdfDocumentHandler = createDocumentHandler({
  kind: "pdf",
  onCreateDocument: (args) =>
    run({
      ...args,
      type: "pdf",
      prompt: `Create a downloadable PDF document titled ${args.title}.`,
    }),
  onUpdateDocument: (args) =>
    run({
      ...args,
      type: "pdf",
      prompt: `${args.description}\n\n${args.document.content}`,
    }),
});
