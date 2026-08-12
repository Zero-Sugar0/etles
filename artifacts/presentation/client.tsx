import { Artifact } from "@/components/create-artifact";
import { PresentationArtifact } from "@/components/presentation-artifact";

export const presentationArtifact = new Artifact({
  kind: "presentation",
  description: "Editable, art-directed presentation deck with varied layouts, visuals, charts, and speaker notes.",
  content: ({ content }) => <PresentationArtifact content={content} />,
  actions: [],
  toolbar: [],
  onStreamPart: ({ setArtifact, streamPart }) => { if (streamPart.type === "data-presentationDelta") setArtifact((artifact) => ({ ...artifact, content: artifact.content + streamPart.data })); },
});
