"use client";

import { Download, FileText, Palette, Printer } from "lucide-react";
import { useState } from "react";
import {
  downloadPdfFromMarkdown,
  type PdfTheme,
  pdfThemeLabels,
  pdfThemes,
} from "@/components/pdf-export";
import { RichArtifactMarkdown } from "@/components/rich-artifact-markdown";
import { ArtifactSourceEditor } from "@/components/artifact-source-editor";
import { Button } from "@/components/ui/button";

export function PdfArtifact({
  content,
  title = "Client document",
  onDownload,
  onSaveContent,
}: {
  content: string;
  title?: string;
  onDownload?: () => void;
  onSaveContent?: (content: string, debounce: boolean) => void;
}) {
  const [theme, setTheme] = useState<PdfTheme>("forest");

  return (
    <ArtifactSourceEditor content={content} onSaveContent={onSaveContent}>
    <div className="min-h-full bg-background p-4 text-foreground sm:p-6 lg:p-10 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-lg border border-border bg-card shadow-sm print:shadow-none">
        <header
          className="relative overflow-hidden bg-primary px-5 py-6 text-primary-foreground sm:px-8 sm:py-10 lg:px-12"
        >
          <div className="absolute -right-10 -top-16 size-48 rounded-full border-[22px] border-primary/20" />
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary-foreground/70">
                <FileText className="size-3.5" /> Etles document studio
              </p>
              <h1 className="mt-4 font-serif text-2xl font-semibold sm:text-3xl">
                {title}
              </h1>
            </div>
            <div className="text-left text-xs text-primary-foreground/70 sm:text-right">
              <div className="mb-3 flex items-center gap-2 sm:justify-end">
                <Palette className="size-3" />
                <select
                  aria-label="PDF color theme"
                  className="rounded border border-white/30 bg-transparent px-2 py-1 text-xs"
                  onChange={(event) => setTheme(event.target.value as PdfTheme)}
                  value={theme}
                >
                  {pdfThemes.map((option) => (
                    <option
                      className="text-foreground"
                      key={option}
                      value={option}
                    >
                      {pdfThemeLabels[option]}
                    </option>
                  ))}
                </select>
              </div>
              <div>Prepared for review</div>
              <div className="mt-1">{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </header>
        <main className="px-5 py-7 sm:px-8 sm:py-10 lg:px-12">
          <RichArtifactMarkdown className="prose-headings:text-foreground prose-a:text-primary prose-blockquote:border-primary prose-blockquote:bg-muted prose-th:bg-muted">
            {content}
          </RichArtifactMarkdown>
        </main>
        <footer className="flex flex-col items-start gap-3 border-t border-border bg-muted/30 px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <span>Confidential working document</span>
          <div className="flex gap-2">
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
