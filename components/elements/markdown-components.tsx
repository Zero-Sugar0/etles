"use client";

import { type ComponentProps, isValidElement } from "react";
import type { ChartToolPayload } from "@/lib/ai/tools/render-chart";
import { cn } from "@/lib/utils";
import { ChartDisplay } from "./chart-display";
import { MermaidDisplay } from "./mermaid-display";

function textFromChildren(children: unknown): string {
  if (typeof children === "string") {
    return children;
  }
  if (Array.isArray(children)) {
    return children.map(textFromChildren).join("");
  }
  return "";
}

function isMermaidSource(source: string, className?: string): boolean {
  const normalized = source.trimStart().toLowerCase();
  return (
    className?.includes("language-mermaid") ||
    normalized.startsWith("graph ") ||
    normalized.startsWith("flowchart ") ||
    normalized.startsWith("sequencediagram") ||
    normalized.startsWith("statediagram") ||
    normalized.startsWith("classdiagram") ||
    normalized.startsWith("erdiagram") ||
    normalized.startsWith("gantt") ||
    normalized.startsWith("journey") ||
    normalized.startsWith("gitgraph") ||
    normalized.startsWith("mindmap") ||
    normalized.startsWith("timeline") ||
    normalized.startsWith("pie ")
  );
}

function parseChartSource(
  source: string,
  className?: string
): ChartToolPayload | null {
  if (!className?.includes("language-chart")) {
    return null;
  }

  try {
    const parsed = JSON.parse(source) as Partial<ChartToolPayload>;
    if (
      typeof parsed.chartType !== "string" ||
      !Array.isArray(parsed.labels) ||
      !Array.isArray(parsed.series) ||
      parsed.series.length === 0 ||
      parsed.labels.length === 0
    ) {
      return null;
    }
    return parsed as ChartToolPayload;
  } catch {
    return null;
  }
}

export const markdownComponents = {
  p: ({ children }: ComponentProps<"p">) => (
    <div className="mb-4 last:mb-0">{children}</div>
  ),
  pre: ({ children, className, ...props }: ComponentProps<"pre">) => {
    if (
      isValidElement<{ className?: string; children?: unknown }>(children) &&
      isMermaidSource(
        textFromChildren(children.props.children),
        children.props.className
      )
    ) {
      return <div className="my-3">{children}</div>;
    }

    return (
      <pre
        className={cn(
          "max-w-full overflow-x-auto rounded-lg border border-border/50 bg-muted/70 p-3 text-xs leading-relaxed",
          className
        )}
        {...props}
      >
        {children}
      </pre>
    );
  },
  code: ({ children, className, ...props }: ComponentProps<"code">) => {
    const source = textFromChildren(children);
    const chart = parseChartSource(source, className);
    if (chart) {
      return <ChartDisplay spec={chart} />;
    }
    if (isMermaidSource(source, className)) {
      return <MermaidDisplay chart={source.trim()} />;
    }

    return (
      <code
        className={cn(
          "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em]",
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  table: ({ children, className, ...props }: ComponentProps<"table">) => (
    <div className="my-4 w-full overflow-x-auto rounded-lg border border-border/60 bg-background shadow-xs">
      <table
        className={cn(
          "w-full min-w-[560px] border-collapse text-left text-sm",
          className
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children, className, ...props }: ComponentProps<"thead">) => (
    <thead
      className={cn("border-border/70 border-b bg-muted/70", className)}
      {...props}
    >
      {children}
    </thead>
  ),
  tbody: ({ children, className, ...props }: ComponentProps<"tbody">) => (
    <tbody className={cn("divide-y divide-border/50", className)} {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, className, ...props }: ComponentProps<"tr">) => (
    <tr
      className={cn(
        "transition-colors hover:bg-muted/35 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  ),
  th: ({ children, className, ...props }: ComponentProps<"th">) => (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-2.5 font-semibold text-foreground text-xs uppercase tracking-wide",
        className
      )}
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, className, ...props }: ComponentProps<"td">) => (
    <td
      className={cn(
        "max-w-[420px] px-3 py-2.5 align-top text-foreground/90 text-sm",
        className
      )}
      {...props}
    >
      {children}
    </td>
  ),
};
