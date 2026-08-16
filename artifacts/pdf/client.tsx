import { Artifact } from "@/components/create-artifact";
import { RedoIcon, UndoIcon } from "@/components/icons";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { PdfArtifact } from "@/components/pdf-artifact";

export const pdfArtifact = new Artifact({
  kind: "pdf",
  description:
    "Print-ready PDF document with proposal, invoice, contract, and brief layouts.",
  content: ({ content, isLoading, title, onSaveContent, suggestions }) =>
    isLoading ? (
      <DocumentSkeleton artifactKind="pdf" />
    ) : (
      <PdfArtifact content={content} onSaveContent={onSaveContent} title={title} suggestions={suggestions} />
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
    if (streamPart.type === "data-pdfDelta") {
      setArtifact((artifact) => ({
        ...artifact,
        content: artifact.content + streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
});
