"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ExpandableContentProps {
  children: React.ReactNode;
  className?: string;
  maxLines?: number;
}

export function ExpandableContent({
  children,
  maxLines = 5,
  className,
}: ExpandableContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldTruncate, setShouldTruncate] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </div>

      {shouldTruncate && (
        <button
          className="flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1 group"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="size-3 group-hover:-translate-y-0.5 transition-transform" />
              <span>Show less</span>
            </>
          ) : (
            <>
              <ChevronDown className="size-3 group-hover:translate-y-0.5 transition-transform" />
              <span>See more</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
