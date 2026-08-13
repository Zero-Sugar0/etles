import { streamText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { plannerPrompt } from "@/lib/ai/prompts";
import { createDocumentHandler } from "@/lib/artifacts/server";
export const plannerDocumentHandler = createDocumentHandler({
  kind: "planner",
  onCreateDocument: async ({ title, dataStream, modelId, prompt, audience, style, data }) => {
    const r = streamText({
      model: getLanguageModel(modelId ?? "google/gemini-2.5-flash"),
      system: plannerPrompt,
      prompt: `${prompt ?? `Build a planner titled ${title}.`}
Audience: ${audience ?? "the user"}
Style: ${style ?? "clear and calm"}
Source data: ${JSON.stringify(data ?? {})}`,
    });
    let c = "";
    for await (const d of r.textStream) {
      c += d;
      dataStream.write({ type: "data-plannerDelta", data: d, transient: true });
    }
    return c;
  },
  onUpdateDocument: async ({ document, description, dataStream, modelId }) => {
    const r = streamText({
      model: getLanguageModel(modelId ?? "google/gemini-2.5-flash"),
      system: plannerPrompt,
      prompt: `${description}\nReturn ONLY updated valid JSON.\n${document.content}`,
    });
    let c = "";
    for await (const d of r.textStream) {
      c += d;
      dataStream.write({ type: "data-plannerDelta", data: d, transient: true });
    }
    return c;
  },
});
