import { Artifact } from "@/components/create-artifact";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { downloadPresentation, PresentationArtifact } from "@/components/presentation-artifact";
import { Download, Pencil } from "lucide-react";
import { RedoIcon, UndoIcon } from "@/components/icons";

export const presentationArtifact = new Artifact({
  kind: "presentation",
  description: "Editable, art-directed presentation deck with varied layouts, visuals, charts, and speaker notes.",
  content: ({ content, isLoading, onSaveContent, suggestions, metadata, status, title }) =>
    isLoading ? (
      <DocumentSkeleton artifactKind="presentation" />
    ) : (
      <PresentationArtifact content={content} onSaveContent={onSaveContent} suggestions={suggestions} editMode={Boolean(metadata?.editMode)} isStreaming={status === "streaming"} title={title} />
    ),
  actions: [
    {
      icon: <Pencil size={16} />,
      description: "Edit presentation content",
      onClick: ({ metadata, setMetadata }) => setMetadata({ ...(metadata ?? {}), editMode: true }),
    },
    {
      icon: <Download size={16} />,
      description: "Download PowerPoint presentation",
      onClick: ({ content, title }) => downloadPresentation(content, title),
    },
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
