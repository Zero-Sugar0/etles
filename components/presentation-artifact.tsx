"use client";

import {
  Download,
  Image as ImageIcon,
  LayoutTemplate,
  Mic2,
} from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";

const palette = {
  midnight: "#123b3a",
  beige: "#f7f5ef",
  peach: "#f2c8b7",
  mint: "#e6efe9",
  ink: "#183231",
  muted: "#647572",
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
    <div className="min-h-full bg-[#ebe7dd] p-4 text-[#183231] sm:p-8">
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
            className={`relative aspect-video overflow-hidden rounded-2xl border border-[#c8d2ce] p-7 shadow-sm ${index % 3 === 0 ? "bg-[#123b3a] text-white" : index % 3 === 1 ? "bg-[#f7f5ef]" : "bg-[#f2c8b7]"}`}
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
                <p className="mt-4 max-w-lg text-sm leading-6 opacity-80">
                  {slide.body}
                </p>
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
                  <div className="h-10 w-28 rounded-full border border-current/20 bg-current/10" />
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
