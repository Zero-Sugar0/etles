import { FileText, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { Artifact } from "@/components/create-artifact";
import { ArtifactSourceEditor } from "@/components/artifact-source-editor";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { markdownComponents } from "@/components/elements/markdown-components";
import { CopyIcon, DownloadIcon, RedoIcon, UndoIcon } from "@/components/icons";
import { downloadPdfFromMarkdown } from "@/components/pdf-export";
import type { Suggestion } from "@/lib/db/schema";
import { getSuggestions } from "../actions";

type ReportArtifactMetadata = {
  suggestions?: Suggestion[];
};

function downloadReport(content: string, title: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "report"}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const reportArtifact = new Artifact<"report", ReportArtifactMetadata>({
  kind: "report",
  description:
    "Useful for polished research reports, briefs, memos, and written analysis.",
  initialize: async ({ documentId, setMetadata }) => {
    const suggestions = await getSuggestions({ documentId });
    setMetadata({ suggestions });
  },
  onStreamPart: ({ setArtifact, streamPart }) => {
    if (streamPart.type === "data-reportDelta") {
      setArtifact((draft) => ({
        ...draft,
        content: draft.content + streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
  content: ({
    content,
    isLoading,
    onSaveContent,
    status,
    suggestions,
    title,
  }) =>
    isLoading && !content ? (
      <DocumentSkeleton artifactKind="report" />
    ) : (
      <ArtifactSourceEditor
        content={content}
        onSaveContent={onSaveContent}
        suggestions={suggestions}
      >
        <article className="min-h-full min-w-0 overflow-x-hidden bg-background px-3 py-5 text-foreground sm:px-6 sm:py-8 md:px-16 md:py-12">
          <div className="mx-auto min-w-0 max-w-3xl">
            <div className="mb-8 flex items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Research brief
                </p>
                <h1 className="mt-2 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
                  {title || "Untitled report"}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {status === "streaming"
                    ? "Writing with source-aware structure"
                    : `Prepared by your agent · ${new Date().toLocaleDateString()}`}
                </p>
              </div>
              <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground">
                Report
              </span>
            </div>
            <Streamdown
              className="report-markdown min-w-0 max-w-full text-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_h1]:font-serif [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight sm:[&_h1]:text-3xl [&_h2]:mt-8 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-2 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-primary [&_li]:leading-7 [&_ol]:my-4 [&_ol]:pl-6 [&_p]:leading-7 [&_strong]:font-semibold [&_table]:text-foreground [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
              components={markdownComponents as any}
            >
              {content}
            </Streamdown>
          </div>
        </article>
      </ArtifactSourceEditor>
    ),
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: "View Previous version",
      onClick: ({ handleVersionChange }) => handleVersionChange("prev"),
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View Next version",
      onClick: ({ handleVersionChange }) => handleVersionChange("next"),
      isDisabled: ({ isCurrentVersion }) => isCurrentVersion,
    },
    {
      icon: <CopyIcon />,
      description: "Copy report",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Report copied");
      },
    },
    {
      icon: <DownloadIcon />,
      description: "Download report (Markdown)",
      onClick: ({ content, title }) => {
        downloadReport(content, title || "research-report");
        toast.success("Report downloaded");
      },
    },
    {
      icon: <FileText size={16} />,
      description: "Download report as PDF",
      onClick: ({ content, title }) => {
        void downloadPdfFromMarkdown(content, title || "Research report");
        toast.success("PDF export started");
      },
    },
  ],
  toolbar: [
    {
      icon: <Sparkles size={16} />,
      description: "Add final polish",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Please add final polish to this report: tighten structure, correct grammar and phrasing, add clear section headings, and ensure every section flows smoothly into the next.",
            },
          ],
        });
      },
    },
    {
      icon: <Wand2 size={16} />,
      description: "Add an executive summary",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Add a concise executive summary at the top of this report that captures the key findings, recommendations, and next steps.",
            },
          ],
        });
      },
    },
  ],
});
