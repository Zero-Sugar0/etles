"use client";

import { ArrowDownRight, ArrowUpRight, CandlestickChart } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type YahooFinancePayload = {
  symbol: string;
  range: string;
  currency?: string | null;
  exchange?: string | null;
  price?: number | null;
  previousClose?: number | null;
  changePercent?: number | null;
  points: Array<{ timestamp: string; close: number }>;
  delayed?: boolean;
};

export function YahooFinanceDisplay({ data }: { data: YahooFinancePayload }) {
  const positive = (data.changePercent ?? 0) >= 0;
  const price =
    data.price == null
      ? "—"
      : data.price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const change =
    data.changePercent == null
      ? "—"
      : `${positive ? "+" : ""}${data.changePercent.toFixed(2)}%`;

  return (
    <Card className="w-full max-w-2xl overflow-hidden border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CandlestickChart aria-hidden="true" className="size-4" />
          </div>
          <div>
            <CardTitle className="font-mono text-sm tracking-tight">
              {data.symbol}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {data.exchange ?? "Market data"} · {data.range}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="font-mono text-[10px]">
          {data.delayed ? "Delayed" : "Live"}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_150px]">
        <div className="min-w-0">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {price}
            </span>
            {data.currency && (
              <span className="text-xs text-muted-foreground">
                {data.currency}
              </span>
            )}
            <span
              className={cn(
                "flex items-center gap-1 font-mono text-xs tabular-nums",
                positive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              )}
            >
              {positive ? (
                <ArrowUpRight aria-hidden="true" className="size-3" />
              ) : (
                <ArrowDownRight aria-hidden="true" className="size-3" />
              )}
              {change}
            </span>
          </div>
          <div
            className="h-36 w-full"
            role="img"
            aria-label={`${data.symbol} price chart for ${data.range}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.points}
                margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id={`finance-fill-${data.symbol}`}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="timestamp" hide />
                <YAxis domain={["dataMin", "dataMax"]} hide />
                <Tooltip
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString()
                  }
                  formatter={(value: unknown) => [
                    typeof value === "number"
                      ? value.toFixed(2)
                      : String(value ?? "—"),
                    "Close",
                  ]}
                />
                <Area
                  dataKey="close"
                  type="monotone"
                  stroke="hsl(var(--primary))"
                  fill={`url(#finance-fill-${data.symbol})`}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 self-start text-xs sm:grid-cols-1">
          <div>
            <dt className="text-muted-foreground">Previous close</dt>
            <dd className="mt-1 font-mono tabular-nums">
              {data.previousClose?.toFixed(2) ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Points</dt>
            <dd className="mt-1 font-mono tabular-nums">
              {data.points.length}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
