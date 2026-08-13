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

const palette = {
  midnight: "#173f3a",
  forest: "#255e52",
  beige: "#f6f2e9",
  paper: "#fffdf8",
  peach: "#efb39f",
  mint: "#b9d8c8",
  gold: "#d6ad61",
  ink: "#19312e",
  muted: "#65746f",
};

type Slide = {
  title?: string;
  body?: string;
  bullets?: string[];
  visual?: string;
  notes?: string;
  layout?: string;
};

export function PresentationArtifact({
  content,
  onDownload,
}: {
  content: string;
  onDownload?: () => void;
}) {
  const slides = useMemo<Slide[]>(() => {
    try {
      const parsed = JSON.parse(content);
      return parsed.slides ?? [parsed];
    } catch {
      return content.split(/\n(?=#|SLIDE)/).map((body) => ({
        title: body
          .split("\n")[0]
          ?.replace(/^#+|SLIDE:?/g, "")
          .trim(),
        body,
      }));
    }
  }, [content]);
  return (
    <div className="min-h-full bg-[#f0ece3] p-4 text-[#19312e] sm:p-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between pb-5">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#647572]">
            <LayoutTemplate className="size-4" /> Presentation studio
          </p>
          <h1 className="mt-1 font-serif text-2xl font-semibold">
            A deck with a point of view
          </h1>
        </div>
        <Button
          className="gap-2 bg-[#123b3a] text-white hover:bg-[#1a5049]"
          onClick={onDownload}
        >
          <Download className="size-4" /> Download .pptx
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {slides.map((slide, index) => (
          <article
            className={`group relative aspect-video overflow-hidden rounded-[1.35rem] border border-black/10 p-7 shadow-[0_16px_40px_rgba(25,49,46,0.12)] transition-transform hover:-translate-y-1 ${index % 4 === 0 ? "bg-[#173f3a] text-white" : index % 4 === 1 ? "bg-[#fffdf8]" : index % 4 === 2 ? "bg-[#efb39f]" : "bg-[#b9d8c8]"}`}
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
                  <RichArtifactMarkdown className="mt-4 max-w-lg text-sm opacity-80 prose-headings:text-current prose-p:my-2 prose-p:leading-6 prose-ul:my-2 prose-ol:my-2">
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
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="flex items-center gap-2 text-xs opacity-70">
                  <Mic2 className="size-4" /> Speaker notes included
                </div>
                {slide.visual ? (
                  <div className="flex items-center gap-2 rounded-full bg-black/10 px-3 py-2 text-xs">
                    <ImageIcon className="size-4" /> {slide.visual}
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
  );
}

export const presentationPalette = palette;
