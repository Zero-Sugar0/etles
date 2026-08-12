import { streamText } from "ai";
import { reportPrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getArtifactModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const reportDocumentHandler = createDocumentHandler<"report">({
  kind: "report",
  onCreateDocument: async ({ title, dataStream, modelId }) => {
    let draftContent = "";
    const result = streamText({
      model: getArtifactModel(modelId),
      system: reportPrompt,
      prompt: title,
    });
    for await (const delta of result.textStream) {
      draftContent += delta;
      dataStream.write({
        type: "data-textDelta",
        data: delta,
        transient: true,
      });
    }
    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream, modelId }) => {
    let draftContent = "";
    const result = streamText({
      model: getArtifactModel(modelId),
      system: updateDocumentPrompt(document.content, "report"),
      prompt: description,
    });
    for await (const delta of result.textStream) {
      draftContent += delta;
      dataStream.write({
        type: "data-textDelta",
        data: delta,
        transient: true,
      });
    }
    return draftContent;
  },
});
