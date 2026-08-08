import { tool } from "ai";
import { z } from "zod";

const rangeMap = {
  "1d": "1d",
  "5d": "5d",
  "1mo": "1mo",
  "3mo": "3mo",
  "6mo": "6mo",
  "1y": "1y",
  "5y": "5y",
} as const;

export const getYahooFinance = tool({
  description:
    "Get delayed market data from Yahoo Finance for a stock, ETF, index, or cryptocurrency. Returns quote details and chart-ready historical prices.",
  inputSchema: z.object({
    symbol: z
      .string()
      .min(1)
      .max(20)
      .describe("Ticker symbol such as AAPL, SPY, ^GSPC, or BTC-USD"),
    range: z
      .enum(Object.keys(rangeMap) as [keyof typeof rangeMap, ...(keyof typeof rangeMap)[]])
      .default("1mo")
      .describe("Historical range to include"),
  }),
  execute: async ({ symbol, range }) => {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const url = new URL(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalizedSymbol)}`
    );
    url.searchParams.set("range", rangeMap[range]);
    url.searchParams.set("interval", range === "1d" ? "5m" : "1d");
    url.searchParams.set("includePrePost", "false");
    url.searchParams.set("events", "div,splits");

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return { error: `Yahoo Finance could not load ${normalizedSymbol}.` };
    }

    const payload = (await response.json()) as {
      chart?: { result?: Array<{ meta?: Record<string, unknown>; timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
    };
    const result = payload.chart?.result?.[0];
    if (!result?.meta) {
      return { error: `No market data found for ${normalizedSymbol}.` };
    }

    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const timestamps = result.timestamp ?? [];
    const points = timestamps
      .map((timestamp, index) => ({
        timestamp: new Date(timestamp * 1000).toISOString(),
        close: closes[index],
      }))
      .filter((point): point is { timestamp: string; close: number } => point.close != null)
      .slice(-250);

    return {
      type: "yahoo-finance",
      symbol: normalizedSymbol,
      range,
      currency: result.meta.currency ?? null,
      exchange: result.meta.exchangeName ?? null,
      quoteType: result.meta.quoteType ?? null,
      marketState: result.meta.marketState ?? null,
      price: result.meta.regularMarketPrice ?? null,
      previousClose: result.meta.previousClose ?? null,
      changePercent:
        typeof result.meta.regularMarketPrice === "number" &&
        typeof result.meta.previousClose === "number" &&
        result.meta.previousClose !== 0
          ? ((result.meta.regularMarketPrice - result.meta.previousClose) /
              result.meta.previousClose) *
            100
          : null,
      points,
      delayed: true,
      attribution: "Yahoo Finance",
    };
  },
});
