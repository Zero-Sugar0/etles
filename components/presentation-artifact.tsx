"use client";

import {
  Download,
  Image as ImageIcon,
  LayoutTemplate,
  Mic2,
} from "lucide-react";
import { useMemo } from "react";
import { RichArtifactMarkdown } from "@/components/rich-artifact-markdown";
import { Button } from "@/components/ui/button";
import { ChartDisplay } from "@/components/elements/chart-display";
import { ArtifactSourceEditor } from "@/components/artifact-source-editor";
import type { ChartToolPayload } from "@/lib/ai/tools/render-chart";

const palette = { mode: "theme tokens" };

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

export function PresentationArtifact({
  content,
  onDownload,
  onSaveContent,
}: {
  content: string;
  onDownload?: () => void;
  onSaveContent?: (content: string, debounce: boolean) => void;
}) {
  const slides = useMemo<Slide[]>(() => {
    const cleanContent = content
      .replace(/^```(?:json|markdown)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    try {
      const parsed = JSON.parse(cleanContent) as { slides?: Slide[] } | Slide[];
      const slideList: Slide[] = Array.isArray(parsed)
        ? parsed
        : (parsed.slides ?? [parsed as Slide]);
      return slideList.map((slide, index) => ({
        ...slide,
        title: slide.title || `Slide ${index + 1}`,
        body: Array.isArray(slide.body)
          ? slide.body.join("\n")
          : slide.body || "",
      }));
    } catch {
      return cleanContent.split(/\n(?=#|SLIDE)/).map((body, index) => ({
        title:
          body
            .split("\n")[0]
            ?.replace(/^#+|SLIDE:?/g, "")
            .trim() || `Slide ${index + 1}`,
        body,
      }));
    }
  }, [content]);
  return (
    <ArtifactSourceEditor content={content} onSaveContent={onSaveContent}>
    <div className="min-h-full bg-background p-4 text-foreground sm:p-8">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <LayoutTemplate className="size-3.5" /> Presentation studio
          </p>
          <h1 className="mt-1 font-serif text-xl font-semibold sm:text-2xl">
            A deck with a point of view
          </h1>
        </div>
        <Button
          className="gap-1.5"
          onClick={onDownload}
          size="sm"
        >
          <Download className="size-3.5" /> Download .pptx
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {slides.map((slide, index) => (
          <article
            className="group relative min-h-[300px] overflow-hidden rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm transition-transform hover:-translate-y-1 sm:min-h-[340px] sm:p-7"
            key={slide.title || `slide-${index}`}
          >
            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="mb-8 flex items-center justify-between text-xs uppercase tracking-[0.18em] opacity-70">
                  <span>0{index + 1}</span>
                  <span>
                    {slide.layout || (index % 2 ? "Insight" : "Narrative")}
                  </span>
                </div>
                <h2 className="max-w-xl font-serif text-3xl font-semibold leading-tight sm:text-4xl">
                  {slide.title || "Untitled slide"}
                </h2>
                {slide.body ? (
                  <RichArtifactMarkdown className="mt-4 max-w-full text-sm opacity-85 prose-headings:text-current prose-p:my-2 prose-p:leading-6 prose-ul:my-2 prose-ol:my-2 prose-table:min-w-[420px] prose-code:text-[0.85em]">
                    {slide.body}
                  </RichArtifactMarkdown>
                ) : null}
                {slide.bullets?.length ? (
                  <ul className="mt-4 grid gap-2 text-sm leading-5">
                    {slide.bullets.map((bullet) => (
                      <li className="flex gap-2" key={bullet}>
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-current" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {slide.table?.headers?.length ? (
                  <div className="mt-5 overflow-x-auto rounded-lg border border-current/15 bg-foreground/5">
                    <table className="w-full min-w-[420px] text-left text-xs">
                      <thead className="border-b border-current/15 bg-foreground/5">
                        <tr>
                          {slide.table.headers.map((header) => (
                            <th className="px-3 py-2 font-semibold" key={header}>{header}</th>
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
                  <img
                    alt={slide.visual || slide.title || "Presentation visual"}
                    className="mt-5 max-h-48 w-full rounded-xl object-cover"
                    src={slide.imageUrl || slide.image}
                  />
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
                ) : (
                  <div className="flex h-14 w-32 items-end gap-1 rounded-xl border border-current/15 bg-current/10 p-2">
                    {[32, 56, 44, 76, 62].map((height) => (
                      <span
                        className="flex-1 rounded-t-sm bg-current/50"
                        key={`chart-bar-${height}`}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
    </ArtifactSourceEditor>
  );
}

export const presentationPalette = palette;
