"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ExpandableContentProps {
  children: React.ReactNode;
  className?: string;
  fadeFromClassName?: string;
  maxLines?: number;
}

export function ExpandableContent({
  children,
  maxLines = 5,
  className,
  fadeFromClassName = "from-secondary",
}: ExpandableContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldTruncate, setShouldTruncate] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Content can change without changing the host element, so remeasure after each render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: children changes the measured DOM content
  useEffect(() => {
    const checkTruncation = () => {
      if (contentRef.current) {
        // Estimate line height (approx 1.5rem or 24px)
        const lineHeight = 24;
        const maxHeight = maxLines * lineHeight;
        if (contentRef.current.scrollHeight > maxHeight + 10) {
          setShouldTruncate(true);
        } else {
          setShouldTruncate(false);
        }
      }
    };

    checkTruncation();
    // Re-check on window resize
    window.addEventListener("resize", checkTruncation);
    return () => window.removeEventListener("resize", checkTruncation);
  }, [children, maxLines]);

  return (
    <div className={cn("relative flex flex-col gap-2", className)}>
      <div
        className={cn("relative transition-all duration-300 ease-in-out", {
          "overflow-hidden": !isExpanded && shouldTruncate,
        })}
        ref={contentRef}
        style={{
          maxHeight:
            !isExpanded && shouldTruncate ? `${maxLines * 1.5}rem` : "none",
        }}
      >
        {children}

        {/* Gradient fade overlay at the bottom of collapsed content */}
        {!isExpanded && shouldTruncate && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t to-transparent",
              fadeFromClassName
            )}
          />
        )}
      </div>

      {shouldTruncate && (
        <button
          aria-expanded={isExpanded}
          className="flex w-full items-center justify-center py-0.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
        >
          {isExpanded ? "Show less" : "Show full message"}
        </button>
      )}
    </div>
  );
}
