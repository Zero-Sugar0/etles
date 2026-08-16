import { Artifact } from "@/components/create-artifact";
import { DashboardArtifact, downloadDashboardCsv } from "@/components/dashboard-artifact";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { RedoIcon, UndoIcon } from "@/components/icons";
import { Download, Pencil } from "lucide-react";

export const dashboardArtifact = new Artifact({
  kind: "dashboard",
  description: "Interactive KPI dashboard with filters, date ranges, charts, and tables.",
  content: ({ content, isLoading, onSaveContent, suggestions, title, metadata }) =>
    isLoading ? (
      <DocumentSkeleton artifactKind="dashboard" />
    ) : (
      <DashboardArtifact content={content} editMode={Boolean(metadata?.editMode)} onSaveContent={onSaveContent} suggestions={suggestions} title={title} />
    ),
  actions: [
    {
      icon: <Download size={16} />,
      description: "Download dashboard CSV",
      onClick: ({ content, title }) => downloadDashboardCsv(content, title),
    },
    {
      icon: <Pencil size={16} />,
      description: "Edit dashboard content",
      onClick: ({ metadata, setMetadata }) => setMetadata({ ...(metadata ?? {}), editMode: true }),
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
    if (streamPart.type === "data-dashboardDelta") {
      setArtifact((artifact) => ({
        ...artifact,
        content: artifact.content + streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
});
