import { Artifact } from "@/components/create-artifact";
import { DashboardArtifact } from "@/components/dashboard-artifact";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { RedoIcon, UndoIcon } from "@/components/icons";

export const dashboardArtifact = new Artifact({
  kind: "dashboard",
  description: "Interactive KPI dashboard with filters, date ranges, charts, and tables.",
  content: ({ content, isLoading, onSaveContent }) =>
    isLoading ? (
      <DocumentSkeleton artifactKind="dashboard" />
    ) : (
      <DashboardArtifact content={content} onSaveContent={onSaveContent} />
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
