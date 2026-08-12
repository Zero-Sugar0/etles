"use client";

import { Download, FileText, Printer } from "lucide-react";
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
  return (
    <div className="min-h-full bg-[#ebe7dd] p-5 sm:p-10">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-sm border border-[#c8d2ce] bg-white shadow-xl">
        <header className="bg-[#123b3a] px-8 py-8 text-white sm:px-12">
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
              <div>Prepared for review</div>
              <div className="mt-1">{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </header>
        <main className="prose prose-slate max-w-none px-8 py-10 prose-headings:font-serif prose-headings:text-[#123b3a] prose-p:leading-7 sm:px-12">
          {content.split("\n").map((line) => {
            if (line.startsWith("# ")) {
              return <h1 key={line}>{line.slice(2)}</h1>;
            }
            if (line.startsWith("## ")) {
              return <h2 key={line}>{line.slice(3)}</h2>;
            }
            if (!line.trim()) {
              return <div className="h-3" key={line} />;
            }
            return <p key={line}>{line.replace(/^[-*] /, "")}</p>;
          })}
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
              onClick={onDownload}
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
