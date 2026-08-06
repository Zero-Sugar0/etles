"use client";

import { useTheme } from "next-themes";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { normalizeMermaidChart } from "@/lib/ai/tools/render-mermaid";

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
  const reactId = useId();
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

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: "base",
          themeVariables: isDark
            ? {
                background: "transparent",
                primaryColor: "#111827",
                primaryTextColor: "#f8fafc",
                primaryBorderColor: "#475569",
                secondaryColor: "#0f172a",
                secondaryTextColor: "#e2e8f0",
                secondaryBorderColor: "#334155",
                tertiaryColor: "#1e293b",
                tertiaryTextColor: "#e2e8f0",
                tertiaryBorderColor: "#475569",
                lineColor: "#94a3b8",
                edgeLabelBackground: "#020617",
                clusterBkg: "#020617",
                clusterBorder: "#334155",
                fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                fontSize: "15px",
                labelTextColor: "#f8fafc",
                nodeTextColor: "#f8fafc",
                textColor: "#e2e8f0",
              }
            : {
                background: "transparent",
                primaryColor: "#ffffff",
                primaryTextColor: "#0f172a",
                primaryBorderColor: "#94a3b8",
                secondaryColor: "#ffffff",
                secondaryTextColor: "#0f172a",
                secondaryBorderColor: "#cbd5e1",
                tertiaryColor: "#f8fafc",
                tertiaryTextColor: "#0f172a",
                tertiaryBorderColor: "#cbd5e1",
                lineColor: "#64748b",
                edgeLabelBackground: "#ffffff",
                clusterBkg: "#f8fafc",
                clusterBorder: "#cbd5e1",
                fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                fontSize: "15px",
                labelTextColor: "#0f172a",
                nodeTextColor: "#0f172a",
                textColor: "#0f172a",
              },
          flowchart: {
            useMaxWidth: false,
            htmlLabels: false,
            curve: "linear",
            padding: 28,
            nodeSpacing: 56,
            rankSpacing: 72,
            wrappingWidth: 180,
          },
          sequence: {
            useMaxWidth: false,
            showSequenceNumbers: false,
          },
          gantt: {
            useMaxWidth: false,
          },
          timeline: {
            useMaxWidth: false,
            disableMulticolor: false,
          },
          mindmap: {
            useMaxWidth: false,
          },
        });

        const id = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

        const sanitizedChart = normalizeMermaidChart(chart);
        const { svg: renderedSvg } = await mermaid.render(id, sanitizedChart);

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
  }, [chart, isDark, reactId]);

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

      <div className="min-h-[160px] w-full overflow-x-auto rounded-lg border border-border/60 bg-background/70 p-3 sm:p-5">
        {isLoading ? (
          <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 py-8">
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
            className="mermaid-rendered min-w-max"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid generates safe SVG
            dangerouslySetInnerHTML={{ __html: svg }}
            ref={containerRef}
          />
        ) : null}
      </div>
      <style jsx>{`
        .mermaid-rendered {
          display: flex;
          justify-content: center;
          width: 100%;
          min-width: 0;
        }

        .mermaid-rendered :global(svg) {
          display: block;
          height: auto;
          max-width: 100%;
          overflow: visible;
          min-width: 0;
        }

        .mermaid-rendered :global(.node rect),
        .mermaid-rendered :global(.node circle),
        .mermaid-rendered :global(.node ellipse),
        .mermaid-rendered :global(.node polygon),
        .mermaid-rendered :global(.node path) {
          filter: drop-shadow(0 8px 18px rgba(15, 23, 42, 0.08));
          stroke-width: 1.5px;
        }

        .mermaid-rendered :global(.nodeLabel),
        .mermaid-rendered :global(.edgeLabel),
        .mermaid-rendered :global(.label) {
          line-height: 1.35;
        }

        .mermaid-rendered :global(.edgeLabel) {
          border-radius: 6px;
          padding: 2px 4px;
        }

        .mermaid-rendered :global(.edgePath .path) {
          stroke-width: 1.8px;
        }
      `}</style>
    </div>
  );
}
