import { Artifact } from "@/components/create-artifact";
import { RedoIcon, UndoIcon } from "@/components/icons";
import { DocumentSkeleton } from "@/components/document-skeleton";
import {
  downloadPlannerCalendar,
  PlannerArtifact,
} from "@/components/planner-artifact";
import { CalendarDays, Download, Pencil, Sparkles } from "lucide-react";
import type { Suggestion } from "@/lib/db/schema";
import { getSuggestions } from "../actions";

type PlannerArtifactMetadata = {
  suggestions?: Suggestion[];
  editMode?: boolean;
};

export const plannerArtifact = new Artifact<"planner", PlannerArtifactMetadata>(
  {
    kind: "planner",
    description:
      "Editable calendar and planner with deadlines, reminders, tasks, and timelines.",
    initialize: async ({ documentId, setMetadata }) => {
      const suggestions = await getSuggestions({ documentId });
      setMetadata({ suggestions, editMode: false });
    },
    content: ({
      content,
      isLoading,
      onSaveContent,
      suggestions,
      metadata,
      title,
    }) =>
      isLoading ? (
        <DocumentSkeleton artifactKind="planner" />
      ) : (
        <PlannerArtifact
          content={content}
          editMode={Boolean(metadata?.editMode)}
          onDownload={() => downloadPlannerCalendar(content, title)}
          onSaveContent={onSaveContent}
          suggestions={suggestions}
          title={title}
        />
      ),
    actions: [
      {
        icon: <Download size={16} />,
        description: "Download calendar file",
        onClick: ({ content, title }) =>
          downloadPlannerCalendar(content, title),
      },
      {
        icon: <Pencil size={16} />,
        description: "Edit planner content",
        onClick: ({ metadata, setMetadata }) =>
          setMetadata({ ...(metadata ?? {}), editMode: true }),
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
    toolbar: [
      {
        icon: <Sparkles size={16} />,
        description: "Sharpen the plan",
        onClick: ({ sendMessage }) => {
          sendMessage({
            role: "user",
            parts: [
              {
                type: "text",
                text: "Sharpen this planner: resolve scheduling conflicts, add realistic time slots to unscheduled tasks, tighten priorities, and keep only events the user will actually care about.",
              },
            ],
          });
        },
      },
      {
        icon: <CalendarDays size={16} />,
        description: "Add a weekly cadence",
        onClick: ({ sendMessage }) => {
          sendMessage({
            role: "user",
            parts: [
              {
                type: "text",
                text: "Add a recurring weekly cadence to this planner such as standup, deep-work blocks, review, and checkpoint meetings without inventing activities the user never mentioned.",
              },
            ],
          });
        },
      },
    ],
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
  }
);
