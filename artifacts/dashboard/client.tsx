import { Artifact } from "@/components/create-artifact";
import {
  DashboardArtifact,
  downloadDashboardCsv,
} from "@/components/dashboard-artifact";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { RedoIcon, UndoIcon } from "@/components/icons";
import { Download, Filter, Pencil, Sparkles } from "lucide-react";
import type { Suggestion } from "@/lib/db/schema";
import { getSuggestions } from "../actions";

type DashboardArtifactMetadata = {
  suggestions?: Suggestion[];
  editMode?: boolean;
};

export const dashboardArtifact = new Artifact<
  "dashboard",
  DashboardArtifactMetadata
>({
  kind: "dashboard",
  description:
    "Interactive KPI dashboard with filters, date ranges, charts, and tables.",
  initialize: async ({ documentId, setMetadata }) => {
    const suggestions = await getSuggestions({ documentId });
    setMetadata({ suggestions, editMode: false });
  },
  content: ({
    content,
    isLoading,
    onSaveContent,
    suggestions,
    title,
    metadata,
  }) =>
    isLoading ? (
      <DocumentSkeleton artifactKind="dashboard" />
    ) : (
      <DashboardArtifact
        content={content}
        editMode={Boolean(metadata?.editMode)}
        onDownload={() => downloadDashboardCsv(content, title)}
        onSaveContent={onSaveContent}
        suggestions={suggestions}
        title={title}
      />
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
      description: "Add narrative insights",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Add short, truthful narrative insights to this dashboard that explain the biggest trends and what to do about them. Do not invent metrics.",
            },
          ],
        });
      },
    },
    {
      icon: <Filter size={16} />,
      description: "Add useful filters",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Add filters such as department, region, date range, and status to this dashboard — only ones the detail data actually supports — and wire the visible rows to filter accordingly.",
            },
          ],
        });
      },
    },
  ],
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
