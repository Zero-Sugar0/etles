import { streamText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";
export const plannerDocumentHandler = createDocumentHandler({
  kind: "planner",
  onCreateDocument: async ({ title, dataStream, modelId }) => {
    const r = streamText({
      model: getLanguageModel(modelId ?? "google/gemini-2.5-flash"),
      system:
        "Return ONLY valid JSON with an events array. Each event has date,title,time,tag. Make it realistic and editable.",
      prompt: `Build a planner titled ${title}.`,
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
      prompt: `${description}\n${document.content}`,
    });
    let c = "";
    for await (const d of r.textStream) {
      c += d;
      dataStream.write({ type: "data-plannerDelta", data: d, transient: true });
    }
    return c;
  },
});
