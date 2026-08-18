import { smoothStream, streamText } from "ai";
import { getArtifactModel } from "@/lib/ai/providers";
import { plannerPrompt } from "@/lib/ai/prompts";
import { createDocumentHandler } from "@/lib/artifacts/server";
export const plannerDocumentHandler = createDocumentHandler({
  kind: "planner",
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
      system: plannerPrompt,
      prompt: `${prompt ?? `Build a planner titled ${title}.`}
Audience: ${audience ?? "the user"}
Style: ${style ?? "clear and calm"}
Source data: ${JSON.stringify(data ?? {})}`,
      experimental_transform: smoothStream({ chunking: "word" }),
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
      model: getArtifactModel(modelId),
      system: plannerPrompt,
      prompt: `${description}\nReturn ONLY updated valid JSON.\n${document.content}`,
      experimental_transform: smoothStream({ chunking: "word" }),
    });
    let c = "";
    for await (const d of r.textStream) {
      c += d;
      dataStream.write({ type: "data-plannerDelta", data: d, transient: true });
    }
    return c;
  },
});
