"use client";

import {
  Image as ImageIcon,
  LayoutTemplate,
  Mic2,
} from "lucide-react";
import pptxgen from "pptxgenjs";
import { useEffect, useMemo, useState } from "react";
import { RichArtifactMarkdown } from "@/components/rich-artifact-markdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Suggestion } from "@/lib/db/schema";
import { ChartDisplay } from "@/components/elements/chart-display";
import { ArtifactSourceEditor } from "@/components/artifact-source-editor";
import type { ChartToolPayload } from "@/lib/ai/tools/render-chart";

const palette = { mode: "theme tokens" };

export type PresentationTheme = "midnight" | "ocean" | "sunset" | "forest" | "violet" | "mono";

type Slide = {
  title?: string;
  body?: string;
  bullets?: string[];
  visual?: string;
  image?: string;
  imageUrl?: string;
  chart?: ChartToolPayload;
  table?: { headers: string[]; rows: (string | number)[][] };
  notes?: string;
  layout?: string;
};

type PresentationDocument = {
  theme?: PresentationTheme;
  slides?: Slide[];
};

const presentationThemes: Record<PresentationTheme, { background: string; foreground: string; accent: string; muted: string }> = {
  midnight: { background: "111827", foreground: "F8FAFC", accent: "38BDF8", muted: "CBD5E1" },
  ocean: { background: "0C4A6E", foreground: "F0F9FF", accent: "67E8F9", muted: "BAE6FD" },
  sunset: { background: "431407", foreground: "FFF7ED", accent: "FDBA74", muted: "FED7AA" },
  forest: { background: "052E16", foreground: "F0FDF4", accent: "86EFAC", muted: "BBF7D0" },
  violet: { background: "2E1065", foreground: "FAF5FF", accent: "D8B4FE", muted: "E9D5FF" },
  mono: { background: "18181B", foreground: "FAFAFA", accent: "A1A1AA", muted: "D4D4D8" },
};

const asText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asText(record.text ?? record.body ?? record.description ?? record.title);
  }
  return "";
};

const asTable = (value: unknown): Slide["table"] | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const table = value as { headers?: unknown; rows?: unknown };
  const headers = Array.isArray(table.headers) ? table.headers.map(asText).filter(Boolean) : [];
  const rows = Array.isArray(table.rows)
    ? table.rows.map((row) => Array.isArray(row) ? row.map((cell) => typeof cell === "number" ? cell : asText(cell)) : [])
    : [];
  return headers.length ? { headers, rows } : undefined;
};

const normalizeSlide = (value: unknown, index: number): Slide => {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawBullets = source.bullets ?? source.points ?? source.items;
  const bullets = Array.isArray(rawBullets)
    ? rawBullets.map(asText).filter(Boolean)
    : [];
  const visual = source.visual && typeof source.visual === "object" ? source.visual as Record<string, unknown> : {};
  return {
    title: asText(source.title ?? source.heading) || `Slide ${index + 1}`,
    body: asText(source.body ?? source.description ?? source.content),
    bullets,
    visual: asText(source.visual),
    image: asText(source.image),
    imageUrl: asText(source.imageUrl ?? visual.url ?? visual.imageUrl),
    chart: source.chart as ChartToolPayload | undefined,
    table: asTable(source.table),
    notes: asText(source.notes ?? source.speakerNotes),
    layout: asText(source.layout ?? source.type) || "narrative",
  };
};

function parsePresentation(content: string): { deck: PresentationDocument; slides: Slide[] } {
  const cleanContent = content
    .replace(/^```(?:json|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    let parsed: unknown = JSON.parse(cleanContent);
    for (let depth = 0; typeof parsed === "string" && depth < 2; depth += 1) parsed = JSON.parse(parsed);
    if (Array.isArray(parsed)) return { deck: {}, slides: parsed.map(normalizeSlide) };
    const record = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    const nested = record.deck && typeof record.deck === "object" ? record.deck as Record<string, unknown> : record;
    const rawSlides = nested.slides ?? nested.sections ?? nested.pages ?? record.slides ?? [];
    return {
      deck: { theme: asText(nested.theme) as PresentationTheme | undefined },
      slides: Array.isArray(rawSlides) ? rawSlides.map(normalizeSlide) : [],
    };
  } catch {
    const blocks = cleanContent.split(/\n(?=(?:#|SLIDE\s*\d*\s*[:.-]))/i).filter(Boolean);
    return { deck: {}, slides: blocks.map((body, index) => normalizeSlide({ body, title: body.split("\n")[0]?.replace(/^#+|SLIDE\s*\d*\s*[:.-]?/i, "").trim() }, index)) };
  }
}

const plainText = (value: string) => value
  .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
  .replace(/[*_`#>]/g, "")
  .trim();

export async function downloadPresentation(content: string, title: string) {
  const { deck, slides } = parsePresentation(content);
  const pptx = new pptxgen();
  const theme = presentationThemes[deck.theme ?? "midnight"] ?? presentationThemes.midnight;
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Etles";
  pptx.subject = title;
  pptx.title = title;
  pptx.company = "Etles";

  for (const [index, item] of slides.entries()) {
    const slide = pptx.addSlide();
    const layout = (item.layout ?? "narrative").toLowerCase();
    const imageLed = layout.includes("hero") || layout.includes("image");
    const chartLed = layout.includes("chart") || layout.includes("data");
    const contentWidth = imageLed || chartLed ? 6.1 : 11.9;
    slide.background = { color: theme.background };
    slide.addText(item.title || `Slide ${index + 1}`, {
      x: 0.6, y: 0.55, w: contentWidth, h: 0.7, fontFace: "Cambria", fontSize: imageLed ? 30 : 26,
      bold: true, color: theme.foreground, margin: 0,
    });
    if (item.body) {
      slide.addText(plainText(item.body), {
        x: 0.65, y: 1.45, w: contentWidth, h: 1.35, fontFace: "Arial", fontSize: 15,
        color: theme.muted, breakLine: false, fit: "shrink", margin: 0.02,
      });
    }
    if (item.bullets?.length) {
      slide.addText(item.bullets.map((bullet) => ({ text: plainText(bullet), options: { bullet: { indent: 14 } } })), {
        x: 0.75, y: item.body ? 2.9 : 1.55, w: contentWidth - 0.4, h: 2.35, fontFace: "Arial", fontSize: 15,
        color: theme.foreground, breakLine: true, fit: "shrink", margin: 0.03,
      });
    }
    if (item.imageUrl || item.image) {
      slide.addImage({ path: item.imageUrl || item.image || "", x: imageLed ? 7.15 : 8.2, y: 1.15, w: imageLed ? 5.45 : 4.2, h: imageLed ? 4.3 : 2.7 });
    }
    if (item.table?.headers?.length) {
      slide.addTable([
        item.table.headers.map((text) => ({ text })),
        ...item.table.rows.map((row) => row.map((value) => ({ text: String(value) }))),
      ], {
        x: 0.7, y: 5.05, w: 7.1, h: 1.45, fontFace: "Arial", fontSize: 10,
        color: theme.foreground, border: { type: "solid", color: theme.muted, pt: 0.5 },
        fill: { color: theme.background, transparency: 12 }, margin: 0.05,
        bold: false,
      });
    }
    if (item.chart?.series?.length) {
      const chartType = item.chart.chartType === "line"
        ? pptx.ChartType.line
        : item.chart.chartType === "pie"
          ? pptx.ChartType.pie
          : pptx.ChartType.bar;
      slide.addChart(chartType, item.chart.series.map((series) => ({ name: series.name, labels: item.chart?.labels ?? [], values: series.data })), {
        x: chartLed ? 0.7 : 7.25, y: chartLed ? 2.55 : 4.4, w: chartLed ? 11.9 : 5.15, h: chartLed ? 3.8 : 2.25,
        showTitle: Boolean(item.chart.title), title: item.chart.title, showLegend: item.chart.series.length > 1,
        chartColors: item.chart.colors ?? [theme.accent], showValue: false,
        catAxisLabelColor: theme.muted, valAxisLabelColor: theme.muted,
        valGridLine: { color: theme.muted, transparency: 70, size: 1 },
      });
    }
    if (item.notes) slide.addNotes(item.notes);
    slide.addText(`${String(index + 1).padStart(2, "0")}  •  ${item.layout ?? "Narrative"}`, {
      x: 0.65, y: 7.05, w: 4, h: 0.2, fontFace: "Arial", fontSize: 8, color: theme.muted, margin: 0,
    });
  }
  await pptx.writeFile({ fileName: `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "presentation"}.pptx` });
}

export function PresentationArtifact({
  title,
  content,
  onSaveContent,
  suggestions = [],
  editMode = false,
  isStreaming = false,
}: {
  title?: string;
  content: string;
  onSaveContent?: (content: string, debounce: boolean) => void;
  suggestions?: Suggestion[];
  editMode?: boolean;
  isStreaming?: boolean;
}) {
  const slides = useMemo(() => parsePresentation(content).slides, [content]);
  const [activeSlide, setActiveSlide] = useState(0);
  const deckTheme = useMemo(
    () => presentationThemes[parsePresentation(content).deck.theme ?? "midnight"] ?? presentationThemes.midnight,
    [content]
  );

  useEffect(() => {
    setActiveSlide((current) => Math.min(current, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  const slide = slides[activeSlide] ?? slides[0];
  const slideLayout = (slide?.layout ?? "narrative").toLowerCase();
  const isImageLed = slideLayout.includes("hero") || slideLayout.includes("image");
  const isDataLed = slideLayout.includes("chart") || slideLayout.includes("data");
  const isSplit = slideLayout.includes("split") || slideLayout.includes("comparison") || isImageLed || isDataLed;
  const renderSlideEditor = (draft: string, setDraft: (value: string) => void) => {
    const parsed = parsePresentation(draft);
    const current = parsed.slides[activeSlide] ?? parsed.slides[0] ?? { title: "", body: "", bullets: [] };
    const update = (changes: Partial<Slide>) => {
      const nextSlides = parsed.slides.length ? [...parsed.slides] : [{ title: "Slide 1", body: "", bullets: [] }];
      nextSlides[activeSlide] = { ...nextSlides[activeSlide], ...changes };
      setDraft(JSON.stringify({ theme: parsed.deck.theme, slides: nextSlides }, null, 2));
    };
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 sm:p-8">
        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="presentation-slide-title">Slide title</label>
          <input className="rounded-md border border-border bg-background px-3 py-2 text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring" id="presentation-slide-title" onChange={(event) => update({ title: event.target.value })} value={current.title ?? ""} />
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="presentation-slide-layout">Layout</label>
          <select className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" id="presentation-slide-layout" onChange={(event) => update({ layout: event.target.value })} value={current.layout ?? "narrative"}>
            <option value="narrative">Narrative</option>
            <option value="split">Split</option>
            <option value="image-led">Image led</option>
            <option value="chart-led">Chart led</option>
            <option value="comparison">Comparison</option>
            <option value="closing">Closing</option>
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="presentation-slide-body">Slide body (Markdown)</label>
          <textarea className="min-h-40 resize-y rounded-md border border-border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring" id="presentation-slide-body" onChange={(event) => update({ body: event.target.value })} value={current.body ?? ""} />
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="presentation-slide-bullets">Bullets (one per line)</label>
          <textarea className="min-h-28 resize-y rounded-md border border-border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring" id="presentation-slide-bullets" onChange={(event) => update({ bullets: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} value={(current.bullets ?? []).join("\n")} />
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="presentation-slide-notes">Speaker notes</label>
          <textarea className="min-h-24 resize-y rounded-md border border-border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring" id="presentation-slide-notes" onChange={(event) => update({ notes: event.target.value })} value={current.notes ?? ""} />
        </div>
      </div>
    );
  };

  if (isStreaming) {
    return (
      <div className="min-h-full bg-background p-4 text-foreground sm:p-8" data-presentation-theme={deckTheme.background}>
        <PresentationSkeleton />
      </div>
    );
  }

  return (
    <ArtifactSourceEditor content={content} editMode={editMode} onSaveContent={onSaveContent} renderEditor={renderSlideEditor} showEditButton={false} suggestions={suggestions}>
      <div className="flex min-h-full flex-col bg-background p-4 text-foreground sm:p-8">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <LayoutTemplate className="size-3.5" /> Presentation studio
          </p>
          <h1 className="mt-1 font-serif text-xl font-semibold sm:text-2xl">
            {title || "Presentation deck"}
          </h1>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <nav aria-label="Presentation slides" className="order-2 flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:w-44 lg:flex-col">
          {slides.map((thumbnail, index) => (
            <button
              aria-label={`Open slide ${index + 1}: ${thumbnail.title}`}
              className={`relative aspect-video w-28 shrink-0 overflow-hidden rounded-md border p-2 text-left transition-colors lg:w-full ${index === activeSlide ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"}`}
              key={`thumbnail-${index}`}
              onClick={() => setActiveSlide(index)}
              type="button"
            >
              <span className="block text-[9px] font-semibold uppercase text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
              <span className="mt-1 block line-clamp-2 text-[10px] font-semibold text-foreground">{thumbnail.title}</span>
            </button>
          ))}
        </nav>
        <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col lg:order-2">
          {slide && (
          <article
            className={`group relative min-h-[420px] flex-1 overflow-y-auto rounded-lg border border-border p-5 shadow-sm sm:p-8 ${isImageLed ? "ring-1 ring-white/10" : ""}`}
            key={`slide-${activeSlide}`}
            style={{ backgroundColor: `#${deckTheme.background}`, color: `#${deckTheme.foreground}` }}
          >
            <div className="flex h-full flex-col justify-between">
              <div className={isSplit ? "grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)] lg:items-start" : ""}>
                <div>
                <div className="mb-8 flex items-center justify-between text-xs uppercase tracking-[0.18em] opacity-70">
                  <span>{String(activeSlide + 1).padStart(2, "0")}</span>
                  <span>
                    {slide.layout || "Narrative"}
                  </span>
                </div>
                <h2 className="max-w-xl font-serif text-3xl font-semibold leading-tight sm:text-4xl">
                  {slide.title || "Untitled slide"}
                </h2>
                {slide.body ? (
                  <RichArtifactMarkdown className="mt-4 max-w-full text-sm text-foreground prose-headings:text-foreground prose-p:my-2 prose-p:leading-6 prose-p:text-foreground prose-li:text-foreground prose-ul:my-2 prose-ol:my-2 prose-table:min-w-[420px] prose-code:text-[0.85em]">
                    {slide.body}
                  </RichArtifactMarkdown>
                ) : null}
                {slide.bullets?.length ? (
                  <ul className="mt-4 grid gap-2 text-sm leading-5">
                    {slide.bullets.map((bullet, bulletIndex) => (
                      <li className="flex gap-2" key={`${bullet}-${bulletIndex}`}>
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-current" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
                </div>
                {isImageLed && (slide.imageUrl || slide.image) ? (
                  <div className="overflow-hidden rounded-xl border border-current/15 bg-black/20 lg:sticky lg:top-0">
                    <img
                      alt={slide.visual || slide.title || "Presentation visual"}
                      className="max-h-[28rem] min-h-48 w-full object-cover"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.closest("div")?.classList.add("hidden");
                      }}
                      src={slide.imageUrl || slide.image}
                    />
                  </div>
                ) : null}
                {slide.table?.headers?.length ? (
                  <div className="mt-5 overflow-x-auto rounded-lg border border-current/15 bg-foreground/5">
                    <table className="w-full min-w-[420px] text-left text-xs">
                      <thead className="border-b border-current/15 bg-foreground/5">
                        <tr>
                          {slide.table.headers.map((header, headerIndex) => (
                            <th className="px-3 py-2 font-semibold" key={`${header}-${headerIndex}`}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {slide.table.rows.map((row, rowIndex) => (
                          <tr className="border-b border-current/10 last:border-0" key={`row-${rowIndex}`}>
                            {row.map((value, columnIndex) => (
                              <td className="px-3 py-2" key={`${rowIndex}-${columnIndex}`}>{String(value)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {slide.chart ? (
                  <div className="mt-5 rounded-xl border border-border/60 bg-background/80 p-2 text-foreground">
                    <ChartDisplay spec={slide.chart} />
                  </div>
                ) : null}
                {(slide.imageUrl || slide.image) ? (
                  <div className={`${isImageLed ? "hidden" : "mt-5"} overflow-hidden rounded-xl border border-border/60 bg-muted/40`}>
                    <img
                      alt={slide.visual || slide.title || "Presentation visual"}
                      className="max-h-48 w-full object-cover"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.closest("div")?.classList.add("hidden");
                      }}
                      src={slide.imageUrl || slide.image}
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="flex items-center gap-2 text-xs opacity-70">
                  <Mic2 className="size-3.5" /> Speaker notes included
                </div>
                {slide.visual ? (
                    <div className="flex items-center gap-2 rounded-full bg-foreground/10 px-3 py-2 text-xs">
                    <ImageIcon className="size-3.5" /> {slide.visual}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
          )}
          <div className="mt-3 flex items-center justify-between">
            <Button disabled={activeSlide === 0} onClick={() => setActiveSlide((current) => Math.max(0, current - 1))} size="sm" variant="outline">Previous</Button>
            <span className="text-xs text-muted-foreground">{activeSlide + 1} of {slides.length}</span>
            <Button disabled={activeSlide === slides.length - 1} onClick={() => setActiveSlide((current) => Math.min(slides.length - 1, current + 1))} size="sm" variant="outline">Next</Button>
          </div>
        </div>
      </div>
      </div>
    </ArtifactSourceEditor>
  );
}

export const presentationPalette = palette;

function PresentationSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-5 w-44" />
      <Skeleton className="h-8 w-80" />
      <div className="grid gap-4 lg:grid-cols-[11rem_1fr]">
        <div className="hidden gap-3 lg:grid">
          {[1, 2, 3, 4, 5].map((item) => <Skeleton className="aspect-video" key={item} />)}
        </div>
        <div className="aspect-video min-h-[420px] rounded-lg border border-border bg-muted/70 p-8">
          <Skeleton className="h-8 w-3/5 bg-muted-foreground/20" />
          <Skeleton className="mt-6 h-4 w-4/5 bg-muted-foreground/20" />
          <Skeleton className="mt-3 h-4 w-2/3 bg-muted-foreground/20" />
          <Skeleton className="mt-12 h-40 w-full bg-muted-foreground/20" />
        </div>
      </div>
    </div>
  );
}
