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

function headingId(children: unknown): string {
  return textFromChildren(children).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
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
  const isChartFence = className?.includes("language-chart");
  const looksLikeChartSpec = /(?:^|\n)\s*(?:type|chartType)\s*:\s*(?:line|bar|area|pie|radar|scatter|composed|funnel|radial)\b/i.test(source);
  if (!isChartFence && !looksLikeChartSpec) {
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
    const values = (key: string) => {
      const match = source.match(new RegExp(`(?:^|\\n)\\s*${key}\\s*:\\s*\\[([^\\]]*)\\]`, "i"));
      return match?.[1].split(",").map((value) => value.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean) ?? [];
    };
    const value = (key: string) => source.match(new RegExp(`(?:^|\\n)\\s*${key}\\s*:\\s*(.+)`, "i"))?.[1].trim().replace(/^['"]|['"]$/g, "");
    const chartType = value("chartType") ?? value("type");
    const labels = values("labels").length ? values("labels") : values("x_axis");
    const numbers = values("data").map(Number).filter(Number.isFinite);
    if (!chartType || !labels.length || !numbers.length) return null;
    return {
      chartType: chartType as ChartToolPayload["chartType"],
      title: value("title"),
      labels,
      series: [{ name: value("series") ?? value("y_axis") ?? "Value", data: numbers }],
    };
  }
}

export const markdownComponents = {
  h1: ({ children, className, ...props }: ComponentProps<"h1">) => (
    <h1 id={props.id ?? headingId(children)} className={cn("font-serif text-3xl font-semibold tracking-tight text-current", className)} {...props}>{children}</h1>
  ),
  h2: ({ children, className, ...props }: ComponentProps<"h2">) => (
    <h2 id={props.id ?? headingId(children)} className={cn("mt-7 font-serif text-2xl font-semibold tracking-tight text-current", className)} {...props}>{children}</h2>
  ),
  h3: ({ children, className, ...props }: ComponentProps<"h3">) => (
    <h3 id={props.id ?? headingId(children)} className={cn("mt-5 text-lg font-semibold text-current", className)} {...props}>{children}</h3>
  ),
  p: ({ children }: ComponentProps<"p">) => (
    <div className="mb-4 text-current/90 last:mb-0">{children}</div>
  ),
  ul: ({ children, className, ...props }: ComponentProps<"ul">) => (
    <ul className={cn("my-3 list-disc space-y-1 pl-5 text-current/90", className)} {...props}>{children}</ul>
  ),
  ol: ({ children, className, ...props }: ComponentProps<"ol">) => (
    <ol className={cn("my-3 list-decimal space-y-1 pl-5 text-current/90", className)} {...props}>{children}</ol>
  ),
  li: ({ children, className, ...props }: ComponentProps<"li">) => (
    <li className={cn("pl-1 leading-6 marker:text-current/60", className)} {...props}>{children}</li>
  ),
  blockquote: ({ children, className, ...props }: ComponentProps<"blockquote">) => (
    <blockquote className={cn("my-4 border-l-2 bg-current/5 px-4 py-2 text-current/90 italic", className)} {...props}>{children}</blockquote>
  ),
  hr: ({ className, ...props }: ComponentProps<"hr">) => (
    <hr className={cn("my-6 border-border", className)} {...props} />
  ),
  a: ({ children, className, ...props }: ComponentProps<"a">) => (
    <a className={cn("font-medium text-primary underline underline-offset-2", className)} rel="noreferrer" target="_blank" {...props}>{children}</a>
  ),
  del: ({ children, className, ...props }: ComponentProps<"del">) => (
    <del className={cn("text-current/60", className)} {...props}>{children}</del>
  ),
  input: ({ className, ...props }: ComponentProps<"input">) => (
    <input className={cn("mr-2 accent-primary", className)} disabled {...props} />
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

    if (
      isValidElement<{ className?: string; children?: unknown }>(children) &&
      parseChartSource(
        textFromChildren(children.props.children),
        children.props.className
      )
    ) {
      return <div className="my-4 min-w-0">{children}</div>;
    }

    return (
      <pre
        className={cn(
          "max-w-full overflow-x-auto rounded-lg border border-current/15 bg-current/5 p-3 text-xs leading-relaxed",
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
          "rounded bg-current/10 px-1.5 py-0.5 font-mono text-[0.92em]",
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  table: ({ children, className, ...props }: ComponentProps<"table">) => (
    <div className="my-4 w-full overflow-x-auto rounded-lg border border-current/15 bg-current/5 shadow-xs">
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
      className={cn("border-current/15 border-b bg-current/10", className)}
      {...props}
    >
      {children}
    </thead>
  ),
  tbody: ({ children, className, ...props }: ComponentProps<"tbody">) => (
    <tbody className={cn("divide-y divide-current/15", className)} {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, className, ...props }: ComponentProps<"tr">) => (
    <tr
      className={cn(
        "transition-colors hover:bg-current/5 data-[state=selected]:bg-current/10",
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
        "whitespace-nowrap px-3 py-2.5 font-semibold text-current text-xs uppercase tracking-wide",
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
        "max-w-[420px] px-3 py-2.5 align-top text-current/90 text-sm",
        className
      )}
      {...props}
    >
      {children}
    </td>
  ),
};
