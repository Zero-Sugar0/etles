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
        "prose prose-sm max-w-none text-foreground prose-headings:font-serif prose-headings:tracking-tight prose-headings:text-foreground prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-lg prose-p:leading-7 prose-p:text-foreground/90 prose-li:leading-6 prose-li:text-foreground/90 prose-strong:font-semibold prose-strong:text-foreground prose-em:text-foreground/90 prose-a:font-medium prose-a:text-primary prose-a:underline prose-a:underline-offset-2 prose-blockquote:border-primary prose-blockquote:text-foreground/90 prose-code:text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      components={markdownComponents as never}
      // Dollar amounts are common in dashboards and reports. Treating every
      // `$...$` pair as inline math corrupts values such as `$13.3B`.
      plugins={{ math: createMathPlugin({ singleDollarTextMath: false }) }}
    >
      {children}
    </Streamdown>
  );
}
