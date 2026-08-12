import { streamText } from "ai";
import { presentationPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const presentationDocumentHandler = createDocumentHandler({
  kind: "presentation",
  onCreateDocument: async ({ title, dataStream, modelId }) => {
    const result = streamText({
      model: getLanguageModel(modelId ?? "google/gemini-2.5-flash"),
      system: presentationPrompt,
      prompt: `Create an editable real-world presentation deck titled "${title}" with varied narrative layouts, images or visual direction, charts where useful, and speaker notes.`,
    });
    let content = "";
    for await (const delta of result.textStream) {
      content += delta;
      dataStream.write({
        type: "data-presentationDelta",
        data: delta,
        transient: true,
      });
    }
    return content;
  },
  onUpdateDocument: async ({ document, description, dataStream, modelId }) => {
    const result = streamText({
      model: getLanguageModel(modelId ?? "google/gemini-2.5-flash"),
      system: presentationPrompt,
      prompt: `Improve this deck according to: ${description}\n\n${document.content}`,
    });
    let content = "";
    for await (const delta of result.textStream) {
      content += delta;
      dataStream.write({
        type: "data-presentationDelta",
        data: delta,
        transient: true,
      });
    }
    return content;
  },
});
