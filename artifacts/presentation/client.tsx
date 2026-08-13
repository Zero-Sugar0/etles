import { Artifact } from "@/components/create-artifact";
import { RedoIcon, UndoIcon } from "@/components/icons";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { PresentationArtifact } from "@/components/presentation-artifact";

export const presentationArtifact = new Artifact({
  kind: "presentation",
  description: "Editable, art-directed presentation deck with varied layouts, visuals, charts, and speaker notes.",
  content: ({ content, isLoading, onSaveContent }) =>
    isLoading ? (
      <DocumentSkeleton artifactKind="presentation" />
    ) : (
      <PresentationArtifact content={content} onSaveContent={onSaveContent} />
    ),
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: "View previous version",
      onClick: ({ handleVersionChange }) => handleVersionChange("prev"),
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View next version",
      onClick: ({ handleVersionChange }) => handleVersionChange("next"),
      isDisabled: ({ isCurrentVersion }) => isCurrentVersion,
    },
  ],
  toolbar: [],
  onStreamPart: ({ setArtifact, streamPart }) => {
    if (streamPart.type === "data-presentationDelta") {
      setArtifact((artifact) => ({
        ...artifact,
        content: artifact.content + streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
});
