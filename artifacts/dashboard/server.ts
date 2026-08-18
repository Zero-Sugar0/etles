import { smoothStream, streamText } from "ai";
import { dashboardPrompt } from "@/lib/ai/prompts";
import { getArtifactModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";
export const dashboardDocumentHandler = createDocumentHandler({
  kind: "dashboard",
  onCreateDocument: async ({
    title,
    dataStream,
    modelId,
    prompt,
    audience,
    style,
    data,
  }) => {
    const r = streamText({
      model: getArtifactModel(modelId),
      system: dashboardPrompt,
      prompt: `${prompt ?? `Build a dashboard titled ${title}.`}
Audience: ${audience ?? "business decision makers"}
Style: ${style ?? "clean, high-contrast, scannable"}
Source data: ${JSON.stringify(data ?? {})}`,
      experimental_transform: smoothStream({ chunking: "word" }),
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
      model: getArtifactModel(modelId),
      system: dashboardPrompt,
      prompt: `${description}\nReturn ONLY updated valid JSON.\n${document.content}`,
      experimental_transform: smoothStream({ chunking: "word" }),
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
