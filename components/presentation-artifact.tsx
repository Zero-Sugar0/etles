"use client";

import { LayoutTemplate } from "lucide-react";
import pptxgen from "pptxgenjs";
import { useEffect, useMemo, useState } from "react";
import { RichArtifactMarkdown } from "@/components/rich-artifact-markdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Suggestion } from "@/lib/db/schema";
import {
  ChartDisplay,
  normalizeChartSpec,
} from "@/components/elements/chart-display";
import { ArtifactSourceEditor } from "@/components/artifact-source-editor";
import type { ChartToolPayload } from "@/lib/ai/tools/render-chart";

export type PresentationTheme =
  | "system"
  | "midnight"
  | "ocean"
  | "sunset"
  | "forest"
  | "violet"
  | "mono";
type PresentationPalette = {
  background?: string;
  foreground?: string;
  accent?: string;
  muted?: string;
};

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
  accent?: string;
  background?: string;
  foreground?: string;
  visualPosition?: "left" | "right" | "full" | "bottom";
  stats?: { label: string; value: string; detail?: string }[];
};

type PresentationDocument = {
  theme?: PresentationTheme;
  palette?: PresentationPalette;
  slides?: Slide[];
};

const presentationThemes: Record<
  PresentationTheme,
  { background: string; foreground: string; accent: string; muted: string }
> = {
  system: {
    background: "var(--background)",
    foreground: "var(--foreground)",
    accent: "var(--primary)",
    muted: "var(--muted-foreground)",
  },
  midnight: {
    background: "111827",
    foreground: "F8FAFC",
    accent: "38BDF8",
    muted: "CBD5E1",
  },
  ocean: {
    background: "0C4A6E",
    foreground: "F0F9FF",
    accent: "67E8F9",
    muted: "BAE6FD",
  },
  sunset: {
    background: "431407",
    foreground: "FFF7ED",
    accent: "FDBA74",
    muted: "FED7AA",
  },
  forest: {
    background: "052E16",
    foreground: "F0FDF4",
    accent: "86EFAC",
    muted: "BBF7D0",
  },
  violet: {
    background: "2E1065",
    foreground: "FAF5FF",
    accent: "D8B4FE",
    muted: "E9D5FF",
  },
  mono: {
    background: "18181B",
    foreground: "FAFAFA",
    accent: "A1A1AA",
    muted: "D4D4D8",
  },
};

function resolvePresentationTheme(deck: PresentationDocument) {
  const base =
    presentationThemes[deck.theme ?? "system"] ?? presentationThemes.system;
  return { ...base, ...deck.palette };
}

function uiColor(value: string) {
  return /^[0-9a-f]{6}$/i.test(value) ? `#${value}` : value;
}

function pptxColor(value: string, fallback: string) {
  return /^[#]?[0-9a-f]{6}$/i.test(value) ? value.replace(/^#/, "") : fallback;
}

const asText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asText(
      record.text ?? record.body ?? record.description ?? record.title
    );
  }
  return "";
};

const asTable = (value: unknown): Slide["table"] | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const table = value as { headers?: unknown; rows?: unknown };
  const headers = Array.isArray(table.headers)
    ? table.headers.map(asText).filter(Boolean)
    : [];
  const rows = Array.isArray(table.rows)
    ? table.rows.map((row) =>
        Array.isArray(row)
          ? row.map((cell) => (typeof cell === "number" ? cell : asText(cell)))
          : []
      )
    : [];
  return headers.length ? { headers, rows } : undefined;
};

const normalizeSlide = (value: unknown, index: number): Slide => {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const rawBullets = source.bullets ?? source.points ?? source.items;
  const bullets = Array.isArray(rawBullets)
    ? rawBullets.map(asText).filter(Boolean)
    : [];
  const visual =
    source.visual && typeof source.visual === "object"
      ? (source.visual as Record<string, unknown>)
      : {};
  return {
    title: asText(source.title ?? source.heading) || `Slide ${index + 1}`,
    body: asText(source.body ?? source.description ?? source.content),
    bullets,
    visual: asText(source.visual),
    image: asText(source.image),
    imageUrl: asText(source.imageUrl ?? visual.url ?? visual.imageUrl),
    chart: normalizeChartSpec(source.chart) ?? undefined,
    table: asTable(source.table),
    notes: asText(source.notes ?? source.speakerNotes),
    layout: asText(source.layout ?? source.type) || "narrative",
    accent: asText(source.accent),
    background: asText(source.background),
    foreground: asText(source.foreground),
    visualPosition: ["left", "right", "full", "bottom"].includes(
      asText(source.visualPosition)
    )
      ? (asText(source.visualPosition) as Slide["visualPosition"])
      : undefined,
    stats: Array.isArray(source.stats)
      ? source.stats
          .map((stat) => {
            const item =
              stat && typeof stat === "object"
                ? (stat as Record<string, unknown>)
                : {};
            return {
              label: asText(item.label),
              value: asText(item.value),
              detail: asText(item.detail),
            };
          })
          .filter((stat) => stat.label && stat.value)
      : undefined,
  };
};

function parsePresentation(content: string): {
  deck: PresentationDocument;
  slides: Slide[];
} {
  const cleanContent = content
    .replace(/^```(?:json|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    let parsed: unknown = JSON.parse(cleanContent);
    for (let depth = 0; typeof parsed === "string" && depth < 2; depth += 1)
      parsed = JSON.parse(parsed);
    if (Array.isArray(parsed))
      return { deck: {}, slides: parsed.map(normalizeSlide) };
    const record =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    const nested =
      record.deck && typeof record.deck === "object"
        ? (record.deck as Record<string, unknown>)
        : record;
    const rawSlides =
      nested.slides ?? nested.sections ?? nested.pages ?? record.slides ?? [];
    return {
      deck: {
        theme: asText(nested.theme) as PresentationTheme | undefined,
        palette:
          nested.palette && typeof nested.palette === "object"
            ? (nested.palette as PresentationPalette)
            : undefined,
      },
      slides: Array.isArray(rawSlides) ? rawSlides.map(normalizeSlide) : [],
    };
  } catch {
    const blocks = cleanContent
      .split(/\n(?=(?:#|SLIDE\s*\d*\s*[:.-]))/i)
      .filter(Boolean);
    return {
      deck: {},
      slides: blocks.map((body, index) =>
        normalizeSlide(
          {
            body,
            title: body
              .split("\n")[0]
              ?.replace(/^#+|SLIDE\s*\d*\s*[:.-]?/i, "")
              .trim(),
          },
          index
        )
      ),
    };
  }
}

const plainText = (value: string) =>
  value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/[*_`#>]/g, "")
    .trim();

export async function downloadPresentation(content: string, title: string) {
  const { deck, slides } = parsePresentation(content);
  const pptx = new pptxgen();
  const deckTheme = resolvePresentationTheme(deck);

  const SLIDE_W = 13.333;
  const SLIDE_H = 7.5;
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Etles";
  pptx.subject = title;
  pptx.title = title;
  pptx.company = "Etles";

  for (const [index, item] of slides.entries()) {
    const pptxSlide = pptx.addSlide();
    const layout = (item.layout ?? "narrative").toLowerCase();
    const isImageLed =
      layout.includes("hero") ||
      layout.includes("image") ||
      item.visualPosition === "left" ||
      item.visualPosition === "right";
    const isChartLed = layout.includes("chart") || layout.includes("data");
    const isCardGrid =
      layout.includes("card") ||
      layout.includes("grid") ||
      layout.includes("solution") ||
      layout.includes("features");
    const imagePath = item.imageUrl || item.image || "";
    const isFullBleed = item.visualPosition === "full" && Boolean(imagePath);

    // Per-slide overrides win over the deck theme.
    const slideColors = {
      background: pptxColor(
        item.background ?? "",
        pptxColor(deckTheme.background, "FFFFFF")
      ),
      foreground: pptxColor(
        item.foreground ?? "",
        pptxColor(deckTheme.foreground, "111111")
      ),
      accent: pptxColor(
        item.accent ?? "",
        pptxColor(deckTheme.accent, "2563EB")
      ),
      muted: pptxColor(deckTheme.muted, "555555"),
    };

    pptxSlide.background = { color: slideColors.background };

    // Full-bleed background visual is drawn before any text so copy sits on top.
    if (isFullBleed && imagePath) {
      pptxSlide.addImage({
        path: imagePath,
        x: 0,
        y: 0,
        w: SLIDE_W,
        h: SLIDE_H,
      });
      pptxSlide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: SLIDE_W,
        h: SLIDE_H,
        fill: { color: "000000", transparency: 45 },
        line: { type: "none" },
      });
    }

    const contentWidth = isImageLed || isChartLed || isFullBleed ? 6.1 : 11.9;
    const imageX = isImageLed ? 7.15 : 8.2;

    pptxSlide.addText(item.title || `Slide ${index + 1}`, {
      x: 0.6,
      y: 0.55,
      w: contentWidth,
      h: 0.7,
      fontFace: "Cambria",
      fontSize: isImageLed || isFullBleed ? 30 : 26,
      bold: true,
      color: slideColors.foreground,
      margin: 0,
    });

    if (item.body) {
      pptxSlide.addText(plainText(item.body), {
        x: 0.65,
        y: 1.45,
        w: contentWidth,
        h: 1.35,
        fontFace: "Arial",
        fontSize: 15,
        color: slideColors.muted,
        breakLine: false,
        fit: "shrink",
        margin: 0.02,
      });
    }

    let nextY = item.body ? 2.9 : 1.55;
    if (item.stats?.length) {
      const statWidth =
        item.stats.length > 1
          ? (contentWidth - 0.5) / item.stats.length
          : contentWidth - 0.2;
      item.stats.forEach((stat, statIndex) => {
        const statX = 0.75 + statIndex * (statWidth + 0.15);
        pptxSlide.addShape(pptx.ShapeType.roundRect, {
          x: statX,
          y: nextY,
          w: statWidth,
          h: 1.25,
          fill: { color: slideColors.foreground, transparency: 88 },
          line: { color: slideColors.accent, transparency: 40, width: 0.75 },
        });
        pptxSlide.addText(
          [
            {
              text: `${stat.value}\n`,
              options: {
                fontSize: 24,
                bold: true,
                color: slideColors.accent,
                fontFace: "Cambria",
              },
            },
            {
              text: stat.label,
              options: { fontSize: 11, color: slideColors.foreground },
            },
            ...(stat.detail
              ? [
                  {
                    text: stat.detail,
                    options: {
                      fontSize: 9,
                      color: slideColors.muted,
                      breakLine: true,
                    },
                  },
                ]
              : []),
          ],
          {
            x: statX + 0.12,
            y: nextY + 0.08,
            w: statWidth - 0.24,
            h: 1.1,
            margin: 0,
          }
        );
      });
      nextY += 1.45;
    }

    if (item.bullets?.length) {
      if (isCardGrid) {
        const perRow = 2;
        const cardWidth = (contentWidth - 0.6) / perRow;
        item.bullets.forEach((bullet, bulletIndex) => {
          const col = bulletIndex % perRow;
          const row = Math.floor(bulletIndex / perRow);
          const separator = bullet.indexOf(":");
          const cardLabel =
            separator > 0
              ? bullet.slice(0, separator)
              : `Point ${bulletIndex + 1}`;
          const cardDetail =
            separator > 0 ? bullet.slice(separator + 1).trim() : bullet;
          const cardX = 0.75 + col * (cardWidth + 0.3);
          const cardY = nextY + row * 0.88;
          pptxSlide.addShape(pptx.ShapeType.roundRect, {
            x: cardX,
            y: cardY,
            w: cardWidth,
            h: 0.82,
            fill: { color: slideColors.foreground, transparency: 90 },
            line: { color: slideColors.accent, transparency: 55, width: 0.5 },
          });
          pptxSlide.addText(
            [
              {
                text: `${cardLabel}\n`,
                options: {
                  fontSize: 13,
                  bold: true,
                  color: slideColors.foreground,
                  breakLine: true,
                },
              },
              {
                text: plainText(cardDetail),
                options: {
                  fontSize: 10,
                  color: slideColors.muted,
                  breakLine: true,
                },
              },
            ],
            {
              x: cardX + 0.1,
              y: cardY + 0.06,
              w: cardWidth - 0.2,
              h: 0.7,
              margin: 0,
            }
          );
        });
        nextY += Math.min(Math.ceil(item.bullets.length / perRow) * 0.88, 2.6);
      } else {
        pptxSlide.addText(
          item.bullets.map((bullet) => ({
            text: plainText(bullet),
            options: { bullet: { indent: 14 } },
          })),
          {
            x: 0.75,
            y: nextY,
            w: contentWidth - 0.4,
            h: 2.35,
            fontFace: "Arial",
            fontSize: 15,
            color: slideColors.foreground,
            breakLine: true,
            fit: "shrink",
            margin: 0.03,
          }
        );
        nextY += 2.5;
      }
    }
    if (imagePath && !isFullBleed) {
      pptxSlide.addImage({
        path: imagePath,
        x: imageX,
        y: 1.15,
        w: isImageLed ? 5.45 : 4.2,
        h: isImageLed ? 4.3 : 2.7,
      });
    }

    if (item.table?.headers?.length) {
      const tableY = Math.max(nextY, 4.4);
      pptxSlide.addTable(
        [
          item.table.headers.map((text) => ({ text })),
          ...item.table.rows.map((row) =>
            row.map((value) => ({ text: String(value) }))
          ),
        ],
        {
          x: 0.7,
          y: tableY,
          w: 7.3,
          h: Math.max(0.7, Math.min(1.45, SLIDE_H - tableY - 0.7)),
          fontFace: "Arial",
          fontSize: 10,
          color: slideColors.foreground,
          border: { type: "solid", color: slideColors.muted, pt: 0.5 },
          fill: { color: slideColors.background, transparency: 12 },
          margin: 0.05,
          bold: false,
        }
      );
    }

    if (item.chart?.series?.length) {
      const chartType =
        item.chart.chartType === "line"
          ? pptx.ChartType.line
          : item.chart.chartType === "pie"
            ? pptx.ChartType.pie
            : pptx.ChartType.bar;
      pptxSlide.addChart(
        chartType,
        item.chart.series.map((series) => ({
          name: series.name,
          labels: item.chart?.labels ?? [],
          values: series.data,
        })),
        {
          x: isChartLed ? 0.7 : 7.25,
          y: isChartLed ? 2.55 : Math.max(nextY, 4.4),
          w: isChartLed ? 11.9 : 4.4,
          h: isChartLed ? 3.8 : 2.25,
          showTitle: Boolean(item.chart.title),
          title: item.chart.title,
          showLegend: item.chart.series.length > 1,
          chartColors: item.chart.colors ?? [slideColors.accent],
          showValue: false,
          catAxisLabelColor: slideColors.muted,
          valAxisLabelColor: slideColors.muted,
          valGridLine: { color: slideColors.muted, size: 1 },
        }
      );
    }

    if (item.notes) pptxSlide.addNotes(item.notes);

    if (!isFullBleed) {
      pptxSlide.addText(String(index + 1).padStart(2, "0"), {
        x: SLIDE_W - 1.05,
        y: SLIDE_H - 0.55,
        w: 0.6,
        h: 0.3,
        align: "right",
        fontFace: "Arial",
        fontSize: 9,
        color: slideColors.muted,
      });
    }
  }
  await pptx.writeFile({
    fileName: `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "presentation"}.pptx`,
  });
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
    () => resolvePresentationTheme(parsePresentation(content).deck),
    [content]
  );

  useEffect(() => {
    setActiveSlide((current) =>
      Math.min(current, Math.max(0, slides.length - 1))
    );
  }, [slides.length]);

  const slide = slides[activeSlide] ?? slides[0];
  const slideLayout = (slide?.layout ?? "narrative").toLowerCase();
  const isImageLed =
    slideLayout.includes("hero") || slideLayout.includes("image");
  const isDataLed =
    slideLayout.includes("chart") || slideLayout.includes("data");
  const isSplit =
    slideLayout.includes("split") ||
    slideLayout.includes("comparison") ||
    isImageLed ||
    isDataLed;
  const isCardGrid =
    slideLayout.includes("card") ||
    slideLayout.includes("grid") ||
    slideLayout.includes("solution") ||
    slideLayout.includes("features");
  const renderSlideEditor = (
    draft: string,
    setDraft: (value: string) => void
  ) => {
    const parsed = parsePresentation(draft);
    const current = parsed.slides[activeSlide] ??
      parsed.slides[0] ?? { title: "", body: "", bullets: [] };
    const update = (changes: Partial<Slide>) => {
      const nextSlides = parsed.slides.length
        ? [...parsed.slides]
        : [{ title: "Slide 1", body: "", bullets: [] }];
      nextSlides[activeSlide] = { ...nextSlides[activeSlide], ...changes };
      setDraft(
        JSON.stringify(
          {
            theme: parsed.deck.theme,
            palette: parsed.deck.palette,
            slides: nextSlides,
          },
          null,
          2
        )
      );
    };
    const updateDeck = (changes: Partial<PresentationDocument>) => {
      const nextSlides = parsed.slides.length
        ? [...parsed.slides]
        : [{ title: "Slide 1", body: "", bullets: [] }];
      setDraft(
        JSON.stringify(
          { ...parsed.deck, ...changes, slides: nextSlides },
          null,
          2
        )
      );
    };
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 sm:p-8">
        <div className="grid gap-2">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="presentation-slide-title"
          >
            Slide title
          </label>
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="presentation-slide-title"
            onChange={(event) => update({ title: event.target.value })}
            value={current.title ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="presentation-slide-layout"
          >
            Layout
          </label>
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="presentation-slide-layout"
            onChange={(event) => update({ layout: event.target.value })}
            value={current.layout ?? "narrative"}
          >
            <option value="narrative">Narrative</option>
            <option value="split">Split</option>
            <option value="image-led">Image led</option>
            <option value="chart-led">Chart led</option>
            <option value="comparison">Comparison</option>
            <option value="closing">Closing</option>
          </select>
        </div>
        <div className="grid gap-2">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="presentation-theme"
          >
            Deck theme
          </label>
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="presentation-theme"
            onChange={(event) =>
              updateDeck({ theme: event.target.value as PresentationTheme })
            }
            value={parsed.deck.theme ?? "system"}
          >
            <option value="system">System</option>
            <option value="midnight">Midnight</option>
            <option value="ocean">Ocean</option>
            <option value="sunset">Sunset</option>
            <option value="forest">Forest</option>
            <option value="violet">Violet</option>
            <option value="mono">Mono</option>
          </select>
        </div>
        <div className="grid gap-2">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="presentation-slide-image"
          >
            Image URL
          </label>
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="presentation-slide-image"
            onChange={(event) => update({ imageUrl: event.target.value })}
            placeholder="https://..."
            value={current.imageUrl ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="presentation-slide-visual-position"
          >
            Visual position
          </label>
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="presentation-slide-visual-position"
            onChange={(event) =>
              update({
                visualPosition: event.target.value
                  ? (event.target.value as Slide["visualPosition"])
                  : undefined,
              })
            }
            value={current.visualPosition ?? "full"}
          >
            <option value="full">Full bleed</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
            <option value="bottom">Bottom</option>
            <option value="">None</option>
          </select>
        </div>
        <div className="grid gap-2">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="presentation-slide-background"
          >
            Background
          </label>
          <input
            className="h-10 w-full rounded-md border border-border bg-background px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="presentation-slide-background"
            onChange={(event) =>
              update({ background: event.target.value.replace("#", "") })
            }
            type="color"
            value={`#${current.background ?? deckTheme.background}`}
          />
        </div>
        <div className="grid gap-2">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="presentation-slide-accent"
          >
            Accent
          </label>
          <input
            className="h-10 w-full rounded-md border border-border bg-background px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="presentation-slide-accent"
            onChange={(event) =>
              update({ accent: event.target.value.replace("#", "") })
            }
            type="color"
            value={`#${current.accent ?? deckTheme.accent}`}
          />
        </div>
        <div className="grid gap-2">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="presentation-slide-body"
          >
            Slide body (Markdown)
          </label>
          <textarea
            className="min-h-40 resize-y rounded-md border border-border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="presentation-slide-body"
            onChange={(event) => update({ body: event.target.value })}
            value={current.body ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="presentation-slide-bullets"
          >
            Bullets (one per line)
          </label>
          <textarea
            className="min-h-28 resize-y rounded-md border border-border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="presentation-slide-bullets"
            onChange={(event) =>
              update({
                bullets: event.target.value
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            value={(current.bullets ?? []).join("\n")}
          />
        </div>
        <div className="grid gap-2">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="presentation-slide-notes"
          >
            Speaker notes
          </label>
          <textarea
            className="min-h-24 resize-y rounded-md border border-border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="presentation-slide-notes"
            onChange={(event) => update({ notes: event.target.value })}
            value={current.notes ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="presentation-slide-stats"
          >
            Stats (JSON array)
          </label>
          <textarea
            className="min-h-24 resize-y rounded-md border border-border bg-background p-3 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="presentation-slide-stats"
            onChange={(event) => {
              try {
                const parsedStats = JSON.parse(
                  event.target.value
                ) as Slide["stats"];
                update({
                  stats: Array.isArray(parsedStats) ? parsedStats : undefined,
                });
              } catch {
                // The draft is only committed once the JSON is valid.
              }
            }}
            placeholder='[{"label":"MRR","value":"$4.2M","detail":"+32% QoQ"}]'
            value={JSON.stringify(current.stats ?? [], null, 2)}
          />
        </div>
      </div>
    );
  };

  if (isStreaming) {
    return (
      <div
        className="min-h-full bg-background p-4 text-foreground sm:p-8"
        data-presentation-theme={deckTheme.background}
      >
        <PresentationSkeleton />
      </div>
    );
  }

  return (
    <ArtifactSourceEditor
      content={content}
      editMode={editMode}
      onSaveContent={onSaveContent}
      renderEditor={renderSlideEditor}
      showEditButton={false}
      suggestions={suggestions}
    >
      <div className="flex min-h-full min-w-0 flex-col overflow-x-hidden bg-background p-3 text-foreground sm:p-6 lg:p-8">
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
          <nav
            aria-label="Presentation slides"
            className="order-2 flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:w-44 lg:flex-col"
          >
            {slides.map((thumbnail, index) => (
              <button
                aria-label={`Open slide ${index + 1}: ${thumbnail.title}`}
                className={`relative aspect-video w-28 shrink-0 overflow-hidden rounded-md border p-2 text-left transition-colors lg:w-full ${index === activeSlide ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"}`}
                key={`thumbnail-${index}`}
                onClick={() => setActiveSlide(index)}
                type="button"
              >
                <div className="absolute inset-0 bg-card">
                  {thumbnail.imageUrl || thumbnail.image ? (
                    <img
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 size-full object-cover opacity-60"
                      loading="lazy"
                      src={thumbnail.imageUrl || thumbnail.image}
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-background/55" />
                </div>
                <div className="relative z-10 flex h-full flex-col justify-between">
                  <span className="block text-[9px] font-semibold uppercase text-foreground/70">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <span className="mt-1 block line-clamp-2 text-[10px] font-semibold text-foreground">
                      {thumbnail.title}
                    </span>
                    {thumbnail.bullets?.length ? (
                      <span className="mt-1 block line-clamp-2 text-[8px] leading-tight text-foreground/70">
                        {thumbnail.bullets.slice(0, 2).join(" · ")}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </nav>
          <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col lg:order-2">
            {slide && (
              <article
                className={`group relative aspect-video min-h-[420px] flex-1 overflow-y-auto rounded-lg border border-border p-5 shadow-sm sm:p-8 lg:min-h-0 ${isImageLed ? "ring-1 ring-white/10" : ""}`}
                key={`slide-${activeSlide}`}
                style={{
                  backgroundColor: uiColor(
                    slide.background || deckTheme.background
                  ),
                  color: uiColor(slide.foreground || deckTheme.foreground),
                }}
              >
                {slide.visualPosition === "full" &&
                (slide.imageUrl || slide.image) ? (
                  <>
                    <img
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 size-full object-cover opacity-45"
                      loading="lazy"
                      src={slide.imageUrl || slide.image}
                    />
                    <div className="absolute inset-0 bg-background/45" />
                  </>
                ) : null}
                <div className="relative z-10 flex h-full flex-col justify-between">
                  <div
                    className={
                      isSplit
                        ? "grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)] lg:items-start"
                        : ""
                    }
                  >
                    <div>
                      <div className="mb-8 flex items-center justify-between text-xs uppercase tracking-[0.18em] opacity-70">
                        <span>{String(activeSlide + 1).padStart(2, "0")}</span>
                      </div>
                      <h2 className="max-w-full break-words font-serif text-2xl font-semibold leading-tight sm:text-4xl">
                        {slide.title || "Untitled slide"}
                      </h2>
                      {slide.body ? (
                        <RichArtifactMarkdown className="mt-4 max-w-full text-sm text-current prose-headings:text-current prose-p:my-2 prose-p:leading-6 prose-p:text-current prose-li:text-current prose-ul:my-2 prose-ol:my-2 prose-table:min-w-[420px] prose-code:text-[0.85em]">
                          {slide.body}
                        </RichArtifactMarkdown>
                      ) : null}
                      {slide.bullets?.length ? (
                        isCardGrid ? (
                          <div className="mt-6 grid gap-3 sm:grid-cols-2">
                            {slide.bullets.map((bullet, bulletIndex) => {
                              const separator = bullet.indexOf(":");
                              const label =
                                separator > 0
                                  ? bullet.slice(0, separator)
                                  : `Point ${bulletIndex + 1}`;
                              const detail =
                                separator > 0
                                  ? bullet.slice(separator + 1).trim()
                                  : bullet;
                              return (
                                <div
                                  className="min-h-24 rounded-xl border border-current/15 bg-foreground/5 p-4"
                                  key={`${bullet}-${bulletIndex}`}
                                >
                                  <p className="text-sm font-semibold leading-5">
                                    {label}
                                  </p>
                                  <p className="mt-2 text-xs leading-5 opacity-75">
                                    {detail}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <ul className="mt-4 grid gap-2 text-sm leading-5">
                            {slide.bullets.map((bullet, bulletIndex) => (
                              <li
                                className="flex gap-2"
                                key={`${bullet}-${bulletIndex}`}
                              >
                                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-current" />
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        )
                      ) : null}
                      {slide.stats?.length ? (
                        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {slide.stats.map((stat) => (
                            <div
                              className="rounded-xl border border-current/15 bg-foreground/5 p-4"
                              key={`${stat.label}-${stat.value}`}
                            >
                              <p className="text-2xl font-semibold tracking-tight">
                                {stat.value}
                              </p>
                              <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] opacity-70">
                                {stat.label}
                              </p>
                              {stat.detail ? (
                                <p className="mt-2 text-xs leading-5 opacity-70">
                                  {stat.detail}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {isImageLed &&
                    slide.visualPosition !== "full" &&
                    (slide.imageUrl || slide.image) ? (
                      <div className="overflow-hidden rounded-xl border border-current/15 bg-foreground/5 lg:sticky lg:top-0">
                        <img
                          alt={
                            slide.visual || slide.title || "Presentation visual"
                          }
                          className="max-h-[28rem] min-h-48 w-full object-cover"
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget
                              .closest("div")
                              ?.classList.add("hidden");
                          }}
                          src={slide.imageUrl || slide.image}
                        />
                      </div>
                    ) : null}
                    {slide.table?.headers?.length ? (
                      <div className="mt-5 overflow-x-auto rounded-lg border border-current/15 bg-foreground/5">
                        <table className="w-full min-w-[420px] text-left text-xs">
                          <thead className="border-b border-current/15 bg-foreground/10">
                            <tr>
                              {slide.table.headers.map(
                                (header, headerIndex) => (
                                  <th
                                    className="px-3 py-2 font-semibold"
                                    key={`${header}-${headerIndex}`}
                                  >
                                    {header}
                                  </th>
                                )
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {slide.table.rows.map((row, rowIndex) => (
                              <tr
                                className="border-b border-current/10 even:bg-foreground/5 last:border-0"
                                key={`row-${rowIndex}`}
                              >
                                {row.map((value, columnIndex) => (
                                  <td
                                    className="px-3 py-2"
                                    key={`${rowIndex}-${columnIndex}`}
                                  >
                                    {String(value)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                    {slide.chart ? (
                      <div className="mt-5 rounded-xl border border-current/15 bg-foreground/5 p-2 text-current">
                        <ChartDisplay spec={slide.chart} />
                      </div>
                    ) : null}
                    {(slide.imageUrl || slide.image) &&
                    slide.visualPosition !== "full" ? (
                      <div
                        className={`${isImageLed ? "hidden" : "mt-5"} overflow-hidden rounded-xl border border-border/60 bg-muted/40`}
                      >
                        <img
                          alt={
                            slide.visual || slide.title || "Presentation visual"
                          }
                          className="max-h-48 w-full object-cover"
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget
                              .closest("div")
                              ?.classList.add("hidden");
                          }}
                          src={slide.imageUrl || slide.image}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-end justify-end gap-4" />
                </div>
              </article>
            )}
            <div className="mt-3 flex items-center justify-between">
              <Button
                disabled={activeSlide === 0}
                onClick={() =>
                  setActiveSlide((current) => Math.max(0, current - 1))
                }
                size="sm"
                variant="outline"
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                {activeSlide + 1} of {slides.length}
              </span>
              <Button
                disabled={activeSlide === slides.length - 1}
                onClick={() =>
                  setActiveSlide((current) =>
                    Math.min(slides.length - 1, current + 1)
                  )
                }
                size="sm"
                variant="outline"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ArtifactSourceEditor>
  );
}

function PresentationSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-5 w-44" />
      <Skeleton className="h-8 w-80" />
      <div className="grid gap-4 lg:grid-cols-[11rem_1fr]">
        <div className="hidden gap-3 lg:grid">
          {[1, 2, 3, 4, 5].map((item) => (
            <Skeleton className="aspect-video" key={item} />
          ))}
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
