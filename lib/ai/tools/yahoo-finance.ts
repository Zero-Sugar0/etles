import { tool } from "ai";
import { z } from "zod";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        exchangeName?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        regularMarketTime?: number;
      };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
    error?: { description?: string };
  };
};

export const yahooFinance = tool({
  description:
    "Read current and historical market data from Yahoo Finance. Use for stock, ETF, index, and crypto symbol quotes. Returns price, change, currency, exchange, and a compact historical series. This is read-only market data, not investment advice; cite the data timestamp and avoid claiming a guaranteed outcome.",
  inputSchema: z.object({
    symbols: z.array(z.string().min(1).max(12)).min(1).max(8).describe("Ticker symbols such as AAPL, MSFT, BTC-USD, or ^GSPC."),
    range: z.enum(["1d", "5d", "1mo", "3mo", "6mo", "1y", "5y"]).default("1mo").describe("Historical window."),
    interval: z.enum(["1d", "1wk", "1mo"]).default("1d").describe("Historical sampling interval."),
  }),
  execute: async ({ symbols, range, interval }) => {
    const results = await Promise.all(
      symbols.map(async (rawSymbol) => {
        const symbol = rawSymbol.trim().toUpperCase();
        const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
        url.searchParams.set("range", range);
        url.searchParams.set("interval", interval);
        url.searchParams.set("events", "div,splits");
        const response = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 60 } });
        if (!response.ok) throw new Error(`Yahoo Finance returned ${response.status} for ${symbol}`);
        const payload = (await response.json()) as YahooChartResponse;
        const result = payload.chart?.result?.[0];
        if (!result?.meta) return { symbol, error: payload.chart?.error?.description ?? "No market data found" };
        const timestamps = result.timestamp ?? [];
        const closes = result.indicators?.quote?.[0]?.close ?? [];
        const history = timestamps
          .map((timestamp, index) => ({ timestamp: new Date(timestamp * 1000).toISOString(), close: closes[index] }))
          .filter((point): point is { timestamp: string; close: number } => typeof point.close === "number")
          .slice(-90);
        const price = result.meta.regularMarketPrice ?? history.at(-1)?.close ?? null;
        const previous = result.meta.chartPreviousClose ?? history.at(-2)?.close ?? null;
        return {
          symbol: result.meta.symbol ?? symbol,
          exchange: result.meta.exchangeName ?? null,
          currency: result.meta.currency ?? null,
          price,
          change: price !== null && previous !== null ? price - previous : null,
          changePercent: price !== null && previous ? ((price - previous) / previous) * 100 : null,
          asOf: result.meta.regularMarketTime ? new Date(result.meta.regularMarketTime * 1000).toISOString() : history.at(-1)?.timestamp ?? null,
          history,
          source: "Yahoo Finance",
        };
      })
    );
    return { results, fetchedAt: new Date().toISOString(), disclaimer: "Market data may be delayed. Informational only, not investment advice." };
  },
});
