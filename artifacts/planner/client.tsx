import { Artifact } from "@/components/create-artifact";
import { RedoIcon, UndoIcon } from "@/components/icons";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { PlannerArtifact } from "@/components/planner-artifact";

export const plannerArtifact = new Artifact({
  kind: "planner",
  description:
    "Editable calendar and planner with deadlines, reminders, tasks, and timelines.",
  content: ({ content, isLoading, onSaveContent }) =>
    isLoading ? (
      <DocumentSkeleton artifactKind="planner" />
    ) : (
      <PlannerArtifact content={content} onSaveContent={onSaveContent} />
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
    if (streamPart.type === "data-plannerDelta") {
      setArtifact((artifact) => ({
        ...artifact,
        content: artifact.content + streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
});
