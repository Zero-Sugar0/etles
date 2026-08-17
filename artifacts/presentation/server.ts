import { streamText } from "ai";
import { presentationPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const presentationDocumentHandler = createDocumentHandler({
  kind: "presentation",
  onCreateDocument: async ({ title, dataStream, modelId, prompt, audience, style, data }) => {
    const result = streamText({
      model: getLanguageModel(modelId ?? "google/gemini-2.5-flash"),
      system: presentationPrompt,
      prompt: `${prompt ?? `Create an editable real-world presentation deck titled "${title}".`}
Audience: ${audience ?? "business decision makers"}
Style: ${style ?? "clear, polished, high-contrast editorial design"}
Source data: ${JSON.stringify(data ?? {})}
Design review before returning JSON: choose a visual archetype for every slide, use supplied image URLs when available, and do not expose visual prompts or speaker notes in visible slide copy. If the source data does not support a chart, use a layout, image, card grid, or truthful stat instead of inventing data.`,
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
      prompt: `Improve this deck according to: ${description}\n\nPreserve useful existing image URLs, charts, tables, and speaker notes. Upgrade weak slides into deliberate hero, split, card-grid, comparison, timeline, or closing compositions. Remove visible image prompts and never invent metrics.\n\n${document.content}`,
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
