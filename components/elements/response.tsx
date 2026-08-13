"use client";

import { createMathPlugin } from "@streamdown/math";
import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { markdownComponents } from "./markdown-components";

type ResponseProps = ComponentProps<typeof Streamdown>;

export function Response({ className, children, ...props }: ResponseProps) {
  return (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto",
        className
      )}
      components={{
        ...(markdownComponents as any),
      }}
      plugins={{ math: createMathPlugin({ singleDollarTextMath: true }) }}
      {...props}
    >
      {children}
    </Streamdown>
  );
}
