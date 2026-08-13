"use client";

import { createMathPlugin } from "@streamdown/math";
import { Streamdown } from "streamdown";
import "katex/dist/katex.min.css";
import { markdownComponents } from "@/components/elements/markdown-components";
import { cn } from "@/lib/utils";

export function RichArtifactMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <Streamdown
      className={cn(
        "prose prose-sm max-w-none prose-headings:font-serif prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-lg prose-p:leading-7 prose-li:leading-6 prose-strong:font-semibold prose-em:text-current/80 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      components={markdownComponents as never}
      plugins={{ math: createMathPlugin({ singleDollarTextMath: true }) }}
    >
      {children}
    </Streamdown>
  );
}
