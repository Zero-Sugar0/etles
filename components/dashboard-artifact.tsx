"use client";

import { ArrowDownRight, ArrowUpRight, BarChart3, Download, Filter, Minus, Pencil, Table2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ArtifactSourceEditor } from "@/components/artifact-source-editor";
import { ChartDisplay } from "@/components/elements/chart-display";
import { RichArtifactMarkdown } from "@/components/rich-artifact-markdown";
import { Button } from "@/components/ui/button";
import type { ChartToolPayload } from "@/lib/ai/tools/render-chart";
import type { Suggestion } from "@/lib/db/schema";

type DashboardKpi = { label: string; value: string | number; change?: string; target?: string; status?: "positive" | "negative" | "neutral"; description?: string };
type DashboardFilter = { label: string; options: string[]; value?: string };
type DashboardRow = Record<string, string | number | boolean | null>;
type DashboardData = { title?: string; eyebrow?: string; description?: string; dateRange?: string; filters?: DashboardFilter[]; kpis?: DashboardKpi[]; charts?: ChartToolPayload[]; series?: ChartToolPayload[]; rows?: DashboardRow[]; insights?: Array<{ title: string; body: string; tone?: "positive" | "warning" | "neutral" }> };

function parseDashboard(content: string): DashboardData {
  const cleaned = content.replace(/^```(?:json|markdown)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    let parsed: unknown = JSON.parse(cleaned);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (!parsed || typeof parsed !== "object") return { description: cleaned };
    const candidate = parsed as DashboardData & { dashboard?: DashboardData; data?: DashboardData; filters?: unknown };
    const source = (candidate.dashboard ?? candidate.data ?? candidate) as DashboardData & { filters?: unknown };
    const filters = Array.isArray(source.filters)
      ? source.filters.flatMap((filter) => typeof filter === "string"
        ? [{ label: filter, options: ["All"], value: "All" }]
        : [filter as DashboardFilter])
      : undefined;
    return { ...source, filters };
  } catch {
    const firstObject = cleaned.indexOf("{");
    const lastObject = cleaned.lastIndexOf("}");
    if (firstObject >= 0 && lastObject > firstObject) {
      const extracted = cleaned.slice(firstObject, lastObject + 1);
      if (extracted === cleaned) return { title: "Dashboard", description: cleaned };
      try {
        return parseDashboard(extracted);
      } catch {
        // Fall through to a readable text dashboard below.
      }
    }
    return cleaned ? { title: "Dashboard", description: cleaned } : {};
  }
}

function trendIcon(status?: DashboardKpi["status"]) {
  if (status === "negative") return <ArrowDownRight className="size-4" />;
  if (status === "neutral") return <Minus className="size-4" />;
  return <ArrowUpRight className="size-4" />;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function downloadDashboardCsv(content: string, title: string) {
  const data = parseDashboard(content);
  const lines: string[] = [];
  if (data.kpis?.length) {
    lines.push("KPI,Value,Change,Target,Status");
    for (const kpi of data.kpis) {
      lines.push([kpi.label, kpi.value, kpi.change, kpi.target, kpi.status].map(csvCell).join(","));
    }
    lines.push("");
  }
  if (data.rows?.length) {
    const columns = Object.keys(data.rows[0]);
    lines.push(columns.map(csvCell).join(","));
    for (const row of data.rows) lines.push(columns.map((column) => csvCell(row[column])).join(","));
  }
  if (!lines.length) return;
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "dashboard"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function DashboardArtifact({ title, content, editMode = false, onDownload, onSaveContent, suggestions = [] }: { title?: string; content: string; editMode?: boolean; onDownload?: () => void; onSaveContent?: (content: string, debounce: boolean) => void; suggestions?: Suggestion[] }) {
  const data = useMemo(() => parseDashboard(content), [content]);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const filters = data.filters ?? [];
  const charts = data.charts ?? data.series ?? [];
  const selectedFilters = useMemo(() => Object.fromEntries(filters.map((filter) => [filter.label, filterValues[filter.label] ?? filter.value ?? filter.options[0] ?? ""])), [filterValues, filters]);
  const rows = useMemo(() => {
    if (!data.rows?.length) return [];
    return data.rows.filter((row) => filters.every((filter) => {
      const selected = selectedFilters[filter.label];
      if (!selected || /^all$/i.test(selected)) return true;
      const rowValue = row[filter.label] ?? row[filter.label.toLowerCase()];
      return rowValue == null || String(rowValue) === selected;
    }));
  }, [data.rows, filters, selectedFilters]);
  const columns = rows.length ? Object.keys(rows[0]) : [];

  return (
    <ArtifactSourceEditor content={content} editMode={editMode} onSaveContent={onSaveContent} showEditButton={false} suggestions={suggestions}>
      <div className="min-h-full bg-background p-4 text-foreground sm:p-7">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              {data.eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{data.eyebrow}</p> : null}
              <h1 className="mt-1 truncate font-serif text-2xl font-semibold sm:text-3xl">{data.title || title || "Dashboard"}</h1>
              {data.description ? <RichArtifactMarkdown className="mt-2 max-w-3xl text-sm text-foreground prose-p:text-foreground prose-strong:text-foreground">{data.description}</RichArtifactMarkdown> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {data.dateRange ? <span className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{data.dateRange}</span> : null}
              {onDownload ? <Button className="gap-2" onClick={onDownload} size="sm" variant="outline"><Download className="size-4" /> Export</Button> : null}
            </div>
          </header>

          {data.kpis?.length ? <section aria-label="Key performance indicators" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.kpis.map((kpi, index) => {
              const status = kpi.status ?? "positive";
              return <article className="rounded-lg border border-border bg-card p-4 shadow-sm" key={`${kpi.label}-${index}`}>
                <div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{kpi.label}</p><span className={status === "negative" ? "text-destructive" : status === "neutral" ? "text-muted-foreground" : "text-primary"}>{trendIcon(status)}</span></div>
                <p className="mt-3 text-2xl font-semibold tracking-tight">{String(kpi.value)}</p>
                {kpi.change || kpi.target ? <p className="mt-1 text-xs text-muted-foreground">{kpi.change ? `${kpi.change} change` : null}{kpi.change && kpi.target ? " · " : null}{kpi.target ? `Target ${kpi.target}` : null}</p> : null}
                {kpi.description ? <p className="mt-2 text-sm text-muted-foreground">{kpi.description}</p> : null}
              </article>;
            })}
          </section> : null}

          {filters.length ? <section className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 p-3"><Filter className="mr-1 size-4 text-muted-foreground" />{filters.map((filter, index) => <label className="flex items-center gap-2 text-sm" key={`${filter.label}-${index}`}><span className="text-muted-foreground">{filter.label}</span><select aria-label={filter.label} className="max-w-[12rem] rounded-md border border-border bg-background px-2.5 py-1.5 text-sm" onChange={(event) => setFilterValues((current) => ({ ...current, [filter.label]: event.target.value }))} value={selectedFilters[filter.label]}>{filter.options.map((option, optionIndex) => <option key={`${option}-${optionIndex}`}>{option}</option>)}</select></label>)}</section> : null}

          {charts.length ? <section className="mt-5 grid gap-4 lg:grid-cols-2">{charts.map((chart, index) => <article className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm" key={`${chart.title || "chart"}-${index}`}><ChartDisplay spec={chart} /></article>)}</section> : null}

          {data.insights?.length ? <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.insights.map((insight, index) => <article className="rounded-lg border border-border bg-card p-4" key={`${insight.title}-${index}`}><div className="flex items-center gap-2 text-sm font-semibold"><BarChart3 className="size-4 text-primary" />{insight.title}</div><RichArtifactMarkdown className="mt-2 text-sm prose-p:text-muted-foreground">{insight.body}</RichArtifactMarkdown></article>)}</section> : null}

          {rows.length ? <section className="mt-5 overflow-hidden rounded-lg border border-border bg-card shadow-sm"><div className="flex items-center gap-2 border-b border-border px-4 py-3"><Table2 className="size-4 text-muted-foreground" /><h2 className="font-semibold">Detail data</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[38rem] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground"><tr>{columns.map((column, index) => <th className="px-4 py-3" key={`${column}-${index}`}>{column}</th>)}</tr></thead><tbody>{rows.slice(0, 50).map((row, rowIndex) => <tr className="border-t border-border/60" key={`row-${rowIndex}`}>{columns.map((column, columnIndex) => <td className="px-4 py-3" key={`${column}-${columnIndex}`}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div></section> : null}

          {!data.kpis?.length && !charts.length && !data.rows?.length && !data.insights?.length ? <div className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">This dashboard has no data sections yet.</div> : null}
        </div>
      </div>
    </ArtifactSourceEditor>
  );
}
