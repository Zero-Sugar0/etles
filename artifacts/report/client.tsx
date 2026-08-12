import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import { CopyIcon, DownloadIcon, RedoIcon, UndoIcon } from "@/components/icons";

function downloadReport(content: string, title: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "report"}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderMarkdown(content: string) {
  return content.split("\n").map((line) => {
    if (line.startsWith("# ")) {
      return (
        <h1
          className="font-serif text-3xl font-semibold tracking-tight text-[#123b3a]"
          key={line}
        >
          {line.slice(2)}
        </h1>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h2
          className="mt-8 border-b border-[#c8d2ce] pb-2 font-serif text-xl font-semibold text-[#123b3a]"
          key={line}
        >
          {line.slice(3)}
        </h2>
      );
    }
    if (line.startsWith("### ")) {
      return (
        <h3 className="mt-5 font-semibold text-[#1d5952]" key={line}>
          {line.slice(4)}
        </h3>
      );
    }
    if (line.startsWith("> ")) {
      return (
        <blockquote
          className="my-4 border-l-4 border-[#f2a98f] bg-[#f8e5dc] px-4 py-3 text-[#31504d]"
          key={line}
        >
          {line.slice(2)}
        </blockquote>
      );
    }
    if (line.startsWith("- ")) {
      return (
        <li className="ml-5 list-disc leading-7 text-[#31504d]" key={line}>
          {line.slice(2)}
        </li>
      );
    }
    if (!line.trim()) {
      return <div className="h-3" key={line} />;
    }
    return (
      <p className="leading-7 text-[#31504d]" key={line}>
        {line}
      </p>
    );
  });
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
  content: ({ content, status }) => (
    <article className="min-h-full bg-[#f7f5ef] px-5 py-8 text-[#183231] sm:px-10 md:px-16 md:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-[#c8d2ce] pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1d5952]">
              Research brief
            </p>
            <p className="mt-1 text-xs text-[#647572]">
              {status === "streaming"
                ? "Writing with source-aware structure"
                : "Prepared by your agent"}
            </p>
          </div>
          <span className="rounded-full bg-[#123b3a] px-3 py-1 text-[11px] font-medium text-white">
            Report
          </span>
        </div>
        <div className="space-y-1">{renderMarkdown(content)}</div>
      </div>
    </article>
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
