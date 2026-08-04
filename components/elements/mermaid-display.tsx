"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type MermaidDisplayProps = {
  chart: string;
  title?: string;
  description?: string;
  className?: string;
};

export function MermaidDisplay({
  chart,
  title,
  description,
  className,
}: MermaidDisplayProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setIsLoading(true);
      setError(null);
      setSvg(null);

      try {
        const { default: mermaid } = await import("mermaid");

        // Configure mermaid with theme
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          themeVariables: isDark
            ? {
                background: "transparent",
                primaryColor: "#1e293b",
                primaryTextColor: "#e2e8f0",
                primaryBorderColor: "#475569",
                lineColor: "#64748b",
                secondaryColor: "#0f172a",
                tertiaryColor: "#1e293b",
                fontSize: "14px",
              }
            : {
                background: "transparent",
                primaryColor: "#f1f5f9",
                primaryTextColor: "#1e293b",
                primaryBorderColor: "#cbd5e1",
                lineColor: "#94a3b8",
                secondaryColor: "#ffffff",
                tertiaryColor: "#f8fafc",
                fontSize: "14px",
              },
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: "basis",
            padding: 16,
          },
          sequence: {
            useMaxWidth: true,
            showSequenceNumbers: false,
          },
          gantt: {
            useMaxWidth: true,
          },
          timeline: {
            useMaxWidth: true,
            disableMulticolor: false,
          },
          mindmap: {
            useMaxWidth: true,
          },
        });

        // Generate a unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;

        const { svg: renderedSvg } = await mermaid.render(id, chart);

        if (!cancelled) {
          setSvg(renderedSvg);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to render diagram";
          setError(message);
          console.error("[MermaidDisplay] Render error:", err);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [chart, isDark]);

  return (
    <div
      className={cn(
        "not-prose w-full overflow-hidden rounded-xl bg-transparent p-1 sm:p-2",
        className
      )}
    >
      {title ? (
        <h3 className="mb-1 px-1 font-semibold text-foreground text-sm sm:text-base">
          {title}
        </h3>
      ) : null}
      {description ? (
        <p className="mb-2 px-1 text-muted-foreground text-xs sm:text-sm">
          {description}
        </p>
      ) : null}

      <div className="flex min-h-[120px] w-full items-center justify-center overflow-x-auto rounded-lg border border-border/50 bg-background/50 p-4">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs text-muted-foreground">
              Rendering diagram...
            </span>
          </div>
        ) : error ? (
          <div className="w-full max-w-lg">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="mb-1 text-xs font-semibold text-destructive">
                Diagram render error
              </p>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                {error}
              </pre>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                Show mermaid source
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[10px] text-muted-foreground">
                {chart}
              </pre>
            </details>
          </div>
        ) : svg ? (
          <div
            className="w-full"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid generates safe SVG
            dangerouslySetInnerHTML={{ __html: svg }}
            ref={containerRef}
          />
        ) : null}
      </div>
    </div>
  );
}
