"use client";

import { ArrowDownRight, ArrowUpRight, CandlestickChart } from "lucide-react";
import {
  Area,
  AreaChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SafeResponsiveContainer } from "@/components/elements/chart-display";
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

const formatNumber = (value: number | null | undefined) =>
  value == null
    ? "—"
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

type FinanceTooltipProps = {
  active?: boolean;
  payload?: Array<{
    value?: unknown;
    payload?: { timestamp?: string };
  }>;
};

function FinanceTooltip({ active, payload }: FinanceTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  const value = payload[0]?.value;
  const date = point?.timestamp
    ? new Date(point.timestamp).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Market close";

  return (
    <div className="min-w-[132px] rounded-lg border border-border/80 bg-popover px-3 py-2 text-popover-foreground shadow-xl">
      <p className="mb-1 text-[11px] text-muted-foreground">{date}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Close
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums">
          {typeof value === "number" ? value.toFixed(2) : "—"}
        </span>
      </div>
    </div>
  );
}

export function YahooFinanceDisplay({ data }: { data: YahooFinancePayload }) {
  const positive = (data.changePercent ?? 0) >= 0;
  const price = formatNumber(data.price);
  const change =
    data.changePercent == null
      ? "—"
      : `${positive ? "+" : ""}${data.changePercent.toFixed(2)}%`;

  return (
    <Card className="w-full min-w-0 max-w-2xl overflow-hidden border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CandlestickChart aria-hidden="true" className="size-4" />
          </div>
          <div>
            <CardTitle className="truncate font-mono text-sm tracking-tight">
              {data.symbol}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {data.exchange ?? "Market data"} · {data.range}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="w-fit font-mono text-[10px]">
          {data.delayed ? "Delayed" : "Live"}
        </Badge>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-5 p-4 sm:grid-cols-[minmax(0,1fr)_150px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-mono text-2xl font-semibold tabular-nums sm:text-3xl">
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
            className="h-40 w-full min-w-0 sm:h-44"
            role="img"
            aria-label={`${data.symbol} price chart for ${data.range}`}
          >
            {data.points.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border/70 text-xs text-muted-foreground">
                No historical chart data available.
              </div>
            ) : (
              <SafeResponsiveContainer minHeight={160}>
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
                  content={<FinanceTooltip />}
                  cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                  isAnimationActive={false}
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
                  activeDot={{
                    r: 4,
                    fill: "hsl(var(--primary))",
                    stroke: "hsl(var(--background))",
                    strokeWidth: 2,
                  }}
                  dot={false}
                  isAnimationActive={false}
                />
                </AreaChart>
              </SafeResponsiveContainer>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t border-border/50 pt-3 text-xs sm:grid-cols-1 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <div>
            <dt className="text-muted-foreground">Previous close</dt>
            <dd className="mt-1 font-mono tabular-nums">
              {formatNumber(data.previousClose)}
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
