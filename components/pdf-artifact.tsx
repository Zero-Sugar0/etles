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
    <div className="min-h-full bg-[#dedbd2] p-5 sm:p-10 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-sm border border-black/10 bg-[#fffdf8] shadow-[0_24px_70px_rgba(35,44,40,0.18)] print:shadow-none">
        <header className="relative overflow-hidden bg-[#173f3a] px-8 py-10 text-white sm:px-12">
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
            if (/^[-*] /.test(line)) {
              return (
                <li className="ml-5 list-disc" key={line}>
                  {line.slice(2)}
                </li>
              );
            }
            if (line.startsWith("> ")) {
              return (
                <blockquote
                  className="border-l-4 border-[#efb39f] bg-[#f8e3da] px-4 py-3 text-[#5d4036]"
                  key={line}
                >
                  {line.slice(2)}
                </blockquote>
              );
            }
            return <p key={line}>{line}</p>;
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
