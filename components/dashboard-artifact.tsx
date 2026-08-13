"use client";

import { CalendarDays, Download, Filter, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { RichArtifactMarkdown } from "@/components/rich-artifact-markdown";
import { Button } from "@/components/ui/button";
import { ChartDisplay } from "@/components/elements/chart-display";
import type { ChartToolPayload } from "@/lib/ai/tools/render-chart";

const bars = [42, 68, 51, 82, 63, 91, 74, 96];
export function DashboardArtifact({
  content,
  onDownload,
}: {
  content: string;
  onDownload?: () => void;
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
    <div className="min-h-full bg-[#f0ece3] p-5 text-[#19312e] sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#647572]">
              Business intelligence
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold">
              Performance, without the noise
            </h1>
          </div>
          <div className="flex gap-2">
            <select
              className="rounded-lg border border-[#c8d2ce] bg-white px-3 py-2 text-sm"
              onChange={(e) => setRange(e.target.value)}
              value={range}
            >
              <option>Last 30 days</option>
              <option>Last quarter</option>
              <option>Year to date</option>
            </select>
            <Button
              className="gap-2 border-[#c8d2ce]"
              onClick={onDownload}
              variant="outline"
            >
              <Download className="size-4" /> Export
            </Button>
          </div>
        </div>
        {data.description ? (
          <RichArtifactMarkdown className="mt-6 max-w-3xl prose-p:text-[#65746f] prose-strong:text-[#173f3a]">
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
                className={`rounded-2xl border border-black/10 p-5 shadow-sm ${index % 3 === 0 ? "bg-[#fffdf8]" : index % 3 === 1 ? "bg-[#e3efe8]" : "bg-[#f8e3da]"}`}
                key={kpi.label}
              >
                <div className="flex justify-between text-xs uppercase tracking-wider text-[#647572]">
                  <span>{kpi.label}</span>
                  <TrendingUp className="size-4 text-[#1d5952]" />
                </div>
                <div className="mt-3 text-3xl font-semibold">{kpi.value}</div>
                <div className="mt-2 text-sm font-medium text-[#1d5952]">
                  {kpi.change} vs previous period
                </div>
              </div>
            )
          )}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <section className="rounded-2xl border border-[#c8d2ce] bg-[#123b3a] p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl">Momentum curve</h2>
                <p className="mt-1 text-sm text-[#dce8e2]">
                  Weekly signal across the selected range
                </p>
              </div>
              <CalendarDays className="size-5 text-[#f2c8b7]" />
            </div>
            <div className="mt-10 flex h-48 items-end gap-3">
              {bars.map((height, index) => (
                <div
                  className="flex flex-1 flex-col justify-end gap-2"
                  key={`bar-${height}`}
                >
                  <div
                    className="rounded-t-md bg-[#f2c8b7]"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-center text-[10px] text-[#dce8e2]">
                    W{index + 1}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-[#c8d2ce] bg-[#ebe7dd] p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl">Filters & views</h2>
              <Filter className="size-5 text-[#647572]" />
            </div>
            <div className="mt-5 grid gap-3">
              {["All regions", "All channels", "All owners"].map((label) => (
                <button
                  className="flex items-center justify-between rounded-xl bg-[#f7f5ef] px-4 py-3 text-left text-sm"
                  key={label}
                  type="button"
                >
                  {label}
                  <span className="text-[#647572]">⌄</span>
                </button>
              ))}
            </div>
          </section>
        </div>
        {charts.length > 0 ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            {charts.map((chart, index) => (
              <div className="rounded-2xl border border-[#c8d2ce] bg-[#fffdf8] p-4" key={chart.title || `chart-${index}`}>
                <ChartDisplay spec={chart} />
              </div>
            ))}
          </section>
        ) : null}
        {data.rows?.length ? (
          <section className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-[#fffdf8]">
            <div className="border-b border-black/10 px-5 py-4">
              <h2 className="font-serif text-xl">Detail view</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#e3efe8] text-xs uppercase tracking-wider text-[#65746f]">
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
                      className="border-t border-black/5"
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
  );
}
