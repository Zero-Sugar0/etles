import { streamText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";
export const dashboardDocumentHandler = createDocumentHandler({
  kind: "dashboard",
  onCreateDocument: async ({ title, dataStream, modelId }) => {
    const r = streamText({
      model: getLanguageModel(modelId ?? "google/gemini-2.5-flash"),
      system:
        "Return ONLY valid JSON with kpis [{label,value,change}], rows, and filters. Design decision-useful business analytics.",
      prompt: `Build a dashboard titled ${title} with realistic structure.`,
    });
    let c = "";
    for await (const d of r.textStream) {
      c += d;
      dataStream.write({
        type: "data-dashboardDelta",
        data: d,
        transient: true,
      });
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
      dataStream.write({
        type: "data-dashboardDelta",
        data: d,
        transient: true,
      });
    }
    return c;
  },
});
