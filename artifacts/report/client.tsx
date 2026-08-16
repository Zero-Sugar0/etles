import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { Artifact } from "@/components/create-artifact";
import { markdownComponents } from "@/components/elements/markdown-components";
import { CopyIcon, DownloadIcon, RedoIcon, UndoIcon } from "@/components/icons";
import { ArtifactSourceEditor } from "@/components/artifact-source-editor";

function downloadReport(content: string, title: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "report"}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const reportArtifact = new Artifact<"report", Record<string, never>>({
  kind: "report",
  description:
    "Useful for polished research reports, briefs, memos, and written analysis.",
  initialize: () => null,
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
  content: ({ content, status, onSaveContent, suggestions }) => (
    <ArtifactSourceEditor content={content} onSaveContent={onSaveContent} suggestions={suggestions}>
    <article className="min-h-full bg-background px-5 py-8 text-foreground sm:px-10 md:px-16 md:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              Research brief
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {status === "streaming"
                ? "Writing with source-aware structure"
                : "Prepared by your agent"}
            </p>
          </div>
          <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground">
            Report
          </span>
        </div>
        <Streamdown
          className="report-markdown text-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_h1]:font-serif [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mt-8 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-2 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-primary [&_li]:leading-7 [&_ol]:my-4 [&_ol]:pl-6 [&_p]:leading-7 [&_strong]:font-semibold [&_table]:text-foreground [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
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
      description: "Download report",
      onClick: ({ content }) => {
        downloadReport(content, "research-report");
        toast.success("Report downloaded");
      },
    },
  ],
  toolbar: [],
});
