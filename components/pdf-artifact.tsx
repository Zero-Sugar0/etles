"use client";

import { Download, Printer } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import {
  downloadPdfFromMarkdown,
  type PdfTheme,
  resolvePdfColors,
} from "@/components/pdf-export";
import { RichArtifactMarkdown } from "@/components/rich-artifact-markdown";
import { ArtifactSourceEditor } from "@/components/artifact-source-editor";
import { Button } from "@/components/ui/button";
import type { Suggestion } from "@/lib/db/schema";

function splitPdfPages(content: string): string[] {
  const normalized = content.trim();
  if (!normalized) return ["# Untitled document"];
  const headings = normalized.split(/(?=^#\s+)/gm).filter(Boolean);
  if (headings.length > 1) return headings;
  const sections = normalized.split(/(?=^##\s+)/gm).filter(Boolean);
  if (sections.length > 1) return sections;
  return [normalized];
}

export function PdfArtifact({
  content,
  title = "Client document",
  onDownload,
  onSaveContent,
  suggestions = [],
}: {
  content: string;
  title?: string;
  onDownload?: () => void;
  onSaveContent?: (content: string, debounce: boolean) => void;
  suggestions?: Suggestion[];
}) {
  const theme: PdfTheme = "forest";
  const colors = resolvePdfColors(content, theme);
  const pages = useMemo(() => splitPdfPages(content), [content]);
  const sections = useMemo(
    () => [...content.matchAll(/^#{1,2}\s+(.+)$/gm)].map((match) => ({
      id: match[1].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section",
      title: match[1].replace(/[*_`]/g, "").trim(),
      level: match[0].startsWith("# ") ? 1 : 2,
    })),
    [content]
  );
  return (
    <ArtifactSourceEditor content={content} onSaveContent={onSaveContent} suggestions={suggestions}>
    <div className="min-h-full min-w-0 overflow-x-hidden bg-background p-2 text-foreground sm:p-5 lg:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-6xl overflow-hidden border border-border/70 bg-background shadow-sm print:border-0 print:shadow-none" style={{ color: `#${colors.body}` }}>
        <header
          className="relative overflow-hidden border-b px-5 py-6 sm:px-10 sm:py-8 lg:px-16"
          style={{ backgroundColor: `#${colors.paper}`, borderColor: `#${colors.wash}`, color: `#${colors.ink}` }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="max-w-3xl break-words font-serif text-3xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              {title}
            </h1>
            <div className="shrink-0 text-left text-xs sm:text-right" style={{ color: `#${colors.muted}` }}>
              <div className="font-medium" style={{ color: `#${colors.body}` }}>Prepared for review</div>
              <div className="mt-1">{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </header>
        <main className="min-w-0 px-3 py-6 sm:px-8 sm:py-12 lg:px-14" style={{ backgroundColor: `#${colors.wash}` }}>
          <div className="mx-auto grid max-w-5xl gap-10 xl:grid-cols-[13rem_minmax(0,1fr)]">
            {sections.length > 1 ? (
              <aside className="hidden xl:block">
                <p className="text-xs font-semibold" style={{ color: `#${colors.muted}` }}>Contents</p>
                <nav className="mt-3 grid gap-2 border-l border-border pl-3" aria-label="Document sections">
                  {sections.map((section) => <a className={`text-sm hover:opacity-80 ${section.level === 2 ? "pl-2 text-xs" : "font-medium"}`} href={`#${section.id}`} key={section.id} style={{ color: `#${colors.body}` }}>{section.title}</a>)}
                </nav>
              </aside>
            ) : <div className="hidden xl:block" />}
            <div className="grid min-w-0 gap-6">
              {pages.map((pageContent, pageIndex) => (
                <article
                  className="relative mx-auto min-h-[720px] w-full max-w-2xl overflow-hidden border shadow-[0_12px_35px_rgba(0,0,0,0.08)] print:min-h-0 print:rounded-none print:border-0 print:shadow-none print:[break-after:page]"
                  key={`pdf-page-${pageIndex}`}
                  style={{ backgroundColor: `#${colors.paper}`, color: `#${colors.body}`, borderColor: `#${colors.wash}`, "--pdf-ink": `#${colors.ink}`, "--pdf-body": `#${colors.body}` } as CSSProperties}
                >
                  <div className="flex items-center justify-between border-b px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] sm:px-10" style={{ borderColor: `#${colors.wash}`, color: `#${colors.ink}` }}>
                    <span>{title}</span>
                    <span>Page {String(pageIndex + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="px-5 pb-20 pt-8 sm:px-10 sm:pb-20 sm:pt-12">
                    <RichArtifactMarkdown className="!text-[var(--pdf-body)] prose-headings:!text-[var(--pdf-ink)] prose-h1:mb-6 prose-h1:text-3xl prose-h1:leading-tight prose-h2:mb-3 prose-h2:border-b prose-h2:pb-2 prose-h2:text-xl prose-h3:text-base prose-p:!text-[var(--pdf-body)] prose-p:text-[15px] prose-p:leading-7 prose-li:!text-[var(--pdf-body)] prose-li:text-[15px] prose-li:leading-7 prose-strong:!text-[var(--pdf-ink)] prose-a:text-primary prose-blockquote:bg-current/5 prose-th:bg-current/10 prose-table:text-sm">
                      {pageContent}
                    </RichArtifactMarkdown>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t px-5 py-3 text-[10px] sm:px-10" style={{ borderColor: `#${colors.wash}`, color: `#${colors.muted}` }}>
                    <span>Etles document studio</span>
                    <span>{pageIndex + 1} / {pages.length}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </main>
        <footer className="flex flex-col items-stretch gap-3 border-t px-4 py-4 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12" style={{ backgroundColor: `#${colors.wash}`, borderColor: `#${colors.accent}55`, color: `#${colors.muted}` }}>
          <span>Confidential working document</span>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              className="gap-2"
              onClick={() => window.print()}
              size="sm"
              variant="outline"
            >
              <Printer className="size-3" /> Print
            </Button>
            <Button
              className="gap-2"
              onClick={() => {
                if (onDownload) {
                  onDownload();
                } else {
                  downloadPdfFromMarkdown(content, title, theme).catch(
                    () => undefined
                  );
                }
              }}
              size="sm"
            >
              <Download className="size-3" /> Download PDF
            </Button>
          </div>
        </footer>
      </div>
    </div>
    </ArtifactSourceEditor>
  );
}
