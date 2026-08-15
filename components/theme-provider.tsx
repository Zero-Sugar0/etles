"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes/dist/types";
import { useEffect, type ReactNode } from "react";

const LIGHT_THEME_COLOR = "hsl(0 0% 100%)";
const DARK_THEME_COLOR = "hsl(240deg 10% 3.92%)";

export function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps & { children?: ReactNode }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export function ThemeColorSync() {
  useEffect(() => {
    const html = document.documentElement;
    let meta = document.querySelector('meta[name="theme-color"]');

    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }

    const updateThemeColor = () => {
      meta?.setAttribute(
        "content",
        html.classList.contains("dark")
          ? DARK_THEME_COLOR
          : LIGHT_THEME_COLOR
      );
    };

    const observer = new MutationObserver(updateThemeColor);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    updateThemeColor();

    return () => observer.disconnect();
  }, []);

  return null;
}
