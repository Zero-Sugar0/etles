"use client";

import { CalendarDays, Download, Filter, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { RichArtifactMarkdown } from "@/components/rich-artifact-markdown";
import { Button } from "@/components/ui/button";
import { ChartDisplay } from "@/components/elements/chart-display";
import { ArtifactSourceEditor } from "@/components/artifact-source-editor";
import type { ChartToolPayload } from "@/lib/ai/tools/render-chart";
import type { Suggestion } from "@/lib/db/schema";

const bars = [42, 68, 51, 82, 63, 91, 74, 96];
export function DashboardArtifact({
  content,
  onDownload,
  onSaveContent,
  suggestions = [],
}: {
  content: string;
  onDownload?: () => void;
  onSaveContent?: (content: string, debounce: boolean) => void;
  suggestions?: Suggestion[];
}) {
  const [range, setRange] = useState("Last 30 days");
  const data = useMemo(() => {
    try {
      return JSON.parse(content);
    } catch {
      return {};
    }
  }, [content]);
  const kpis = data.kpis ?? [
    { label: "Revenue", value: "$84.2k", change: "+18.4%" },
    { label: "Conversion", value: "6.8%", change: "+2.1%" },
    { label: "Active pipeline", value: "128", change: "+14" },
  ];
  const charts = (data.charts ?? data.series ?? []) as ChartToolPayload[];
  return (
    <ArtifactSourceEditor content={content} onSaveContent={onSaveContent} suggestions={suggestions}>
    <div className="min-h-full bg-background p-5 text-foreground sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Business intelligence
            </p>
            <h1 className="mt-2 font-serif text-2xl font-semibold sm:text-3xl">
              Performance, without the noise
            </h1>
          </div>
          <div className="flex gap-2">
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              onChange={(e) => setRange(e.target.value)}
              value={range}
            >
              <option>Last 30 days</option>
              <option>Last quarter</option>
              <option>Year to date</option>
            </select>
            <Button
              className="gap-2"
              onClick={onDownload}
              variant="outline"
            >
              <Download className="size-4" /> Export
            </Button>
          </div>
        </div>
        {data.description ? (
          <RichArtifactMarkdown className="mt-6 max-w-3xl prose-p:text-muted-foreground prose-strong:text-foreground">
            {data.description}
          </RichArtifactMarkdown>
        ) : null}
        <div className="mt-7 grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {kpis.map(
            (
              kpi: {
                label: string;
                value: string;
                change?: string;
                target?: string;
              },
              index: number
            ) => (
              <div
                className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm"
                key={`${kpi.label}-${index}`}
              >
                <div className="flex justify-between text-xs uppercase tracking-wider text-muted-foreground">
                  <span>{kpi.label}</span>
                  <TrendingUp className="size-4 text-primary" />
                </div>
                <div className="mt-3 text-3xl font-semibold">{kpi.value}</div>
                <div className="mt-2 text-sm font-medium text-primary">
                  {kpi.change} vs previous period
                </div>
              </div>
            )
          )}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <section className="rounded-lg border border-border bg-card p-6 text-card-foreground">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl">Momentum curve</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Weekly signal across the selected range
                </p>
              </div>
              <CalendarDays className="size-5 text-primary" />
            </div>
            <div className="mt-10 flex h-48 items-end gap-3">
              {bars.map((height, index) => (
                <div
                  className="flex flex-1 flex-col justify-end gap-2"
                  key={`bar-${index}`}
                >
                  <div
                    className="rounded-t-md bg-primary"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-center text-[10px] text-muted-foreground">
                    W{index + 1}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-border bg-muted/30 p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl">Filters & views</h2>
              <Filter className="size-5 text-muted-foreground" />
            </div>
            <div className="mt-5 grid gap-3">
              {["All regions", "All channels", "All owners"].map((label, index) => (
                <button
                  className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3 text-left text-sm"
                  key={`${label}-${index}`}
                  type="button"
                >
                  {label}
                  <span className="text-muted-foreground">⌄</span>
                </button>
              ))}
            </div>
          </section>
        </div>
        {charts.length > 0 ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            {charts.map((chart, index) => (
              <div className="rounded-lg border border-border bg-card p-4" key={`${chart.title || "chart"}-${index}`}>
                <ChartDisplay spec={chart} />
              </div>
            ))}
          </section>
        ) : null}
        {data.rows?.length ? (
          <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-serif text-xl">Detail view</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    {Object.keys(data.rows[0]).map((key: string) => (
                      <th className="px-5 py-3" key={key}>
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.slice(0, 8).map((row: Record<string, string>) => (
                    <tr
                      className="border-t border-border/50"
                      key={JSON.stringify(row)}
                    >
                      {Object.entries(row).map(([key, value]) => (
                        <td
                          className="px-5 py-3"
                          key={`${key}-${String(value)}`}
                        >
                          {String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </div>
    </ArtifactSourceEditor>
  );
}
