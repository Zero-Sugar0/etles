"use client";

import { Download, FileText, Palette, Printer } from "lucide-react";
import { useState } from "react";
import {
  downloadPdfFromMarkdown,
  type PdfTheme,
  pdfThemeColors,
  pdfThemeLabels,
  pdfThemes,
} from "@/components/pdf-export";
import { RichArtifactMarkdown } from "@/components/rich-artifact-markdown";
import { Button } from "@/components/ui/button";

export function PdfArtifact({
  content,
  title = "Client document",
  onDownload,
}: {
  content: string;
  title?: string;
  onDownload?: () => void;
}) {
  const [theme, setTheme] = useState<PdfTheme>("forest");
  const palette = pdfThemeColors[theme];

  return (
    <div className="min-h-full bg-[#dedbd2] p-5 sm:p-10 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-sm border border-black/10 bg-[#fffdf8] shadow-[0_24px_70px_rgba(35,44,40,0.18)] print:shadow-none">
        <header
          className="relative overflow-hidden px-8 py-10 text-white sm:px-12"
          style={{ backgroundColor: `#${palette.ink}` }}
        >
          <div className="absolute -right-10 -top-16 size-48 rounded-full border-[22px] border-[#efb39f]/40" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#dce8e2]">
                <FileText className="size-4" /> Etles document studio
              </p>
              <h1 className="mt-5 font-serif text-3xl font-semibold">
                {title}
              </h1>
            </div>
            <div className="text-right text-xs text-[#dce8e2]">
              <div className="mb-3 flex items-center justify-end gap-2">
                <Palette className="size-3" />
                <select
                  aria-label="PDF color theme"
                  className="rounded border border-white/30 bg-transparent px-2 py-1 text-xs"
                  onChange={(event) => setTheme(event.target.value as PdfTheme)}
                  value={theme}
                >
                  {pdfThemes.map((option) => (
                    <option
                      className="text-[#173f3a]"
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
        <main className="px-8 py-10 sm:px-12">
          <RichArtifactMarkdown className="prose-headings:text-[#173f3a] prose-a:text-[#255e52] prose-blockquote:border-[#efb39f] prose-blockquote:bg-[#f8e3da] prose-th:bg-[#e3efe8]">
            {content}
          </RichArtifactMarkdown>
        </main>
        <footer className="flex items-center justify-between border-t border-[#c8d2ce] bg-[#f7f5ef] px-8 py-4 text-xs text-[#647572] sm:px-12">
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
              className="gap-2 bg-[#123b3a] text-white"
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
  );
}
