"use client";

import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GeneratedImage = { url: string; alt?: string };

export function GeneratedImageCarousel({
  images,
}: {
  images: GeneratedImage[];
}) {
  const [active, setActive] = useState(0);
  if (!images.length) return null;
  const current = images[active];
  const move = (delta: number) =>
    setActive((index) => (index + delta + images.length) % images.length);

  return (
    <div className="w-full max-w-2xl space-y-2">
      <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-muted/30 shadow-sm">
        <a
          href={current.url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open generated image"
        >
          <img
            src={current.url}
            alt={current.alt ?? `Generated image ${active + 1}`}
            className="block max-h-[min(70vh,560px)] w-full object-contain transition-transform duration-300 group-hover:scale-[1.01]"
            loading="lazy"
          />
        </a>
        {images.length > 1 ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute left-2 top-1/2 size-9 -translate-y-1/2 rounded-full opacity-90 shadow-sm"
              onClick={() => move(-1)}
              aria-label="Previous image"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-2 top-1/2 size-9 -translate-y-1/2 rounded-full opacity-90 shadow-sm"
              onClick={() => move(1)}
              aria-label="Next image"
            >
              <ChevronRight className="size-4" />
            </Button>
          </>
        ) : null}
        <a
          href={current.url}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-xs text-foreground shadow-sm backdrop-blur"
          aria-label="Open image in new tab"
        >
          <ExternalLink className="size-3" />
          Open
        </a>
      </div>
      {images.length > 1 ? (
        <div
          className="flex items-center justify-center gap-1.5"
          aria-label="Generated image slides"
        >
          {images.map((image, index) => (
            <button
              type="button"
              key={image.url}
              aria-label={`Show image ${index + 1}`}
              aria-current={index === active}
              onClick={() => setActive(index)}
              className={cn(
                "size-2 rounded-full bg-muted-foreground/35 transition-all",
                index === active && "w-5 bg-foreground"
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
