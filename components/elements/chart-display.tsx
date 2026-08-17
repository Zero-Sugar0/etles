"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartToolPayload } from "@/lib/ai/tools/render-chart";
import { cn } from "@/lib/utils";

type SafeResponsiveContainerProps = {
  children: ReactNode;
  className?: string;
  minHeight?: number;
};

/** Wait for a measurable layout before mounting Recharts. Hidden tabs and dialogs can report -1. */
export function SafeResponsiveContainer({
  children,
  className,
  minHeight = 1,
}: SafeResponsiveContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setDimensions((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height }
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("h-full min-h-0 min-w-0 w-full", className)}
      style={{ minHeight }}
    >
      {dimensions.width > 0 && dimensions.height > 0 ? (
        <ResponsiveContainer
          height={dimensions.height}
          minHeight={1}
          minWidth={1}
          width={dimensions.width}
        >
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

const DEFAULT_SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

type ChartDisplayProps = {
  spec: ChartToolPayload | unknown;
  className?: string;
};

/** Normalize persisted/AI-authored chart payloads before Recharts sees them. */
export function normalizeChartSpec(input: unknown): ChartToolPayload | null {
  if (!input || typeof input !== "object") return null;
  const source = input as Record<string, unknown>;
  const rawSeries = Array.isArray(source.series) ? source.series : [];
  const series = rawSeries
    .map((value, index) => {
      if (!value || typeof value !== "object") return null;
      const item = value as Record<string, unknown>;
      const data = Array.isArray(item.data)
        ? item.data.map((point) => (typeof point === "number" ? point : Number(point) || 0))
        : [];
      return {
        name: typeof item.name === "string" && item.name.trim() ? item.name : `Series ${index + 1}`,
        data,
        ...(typeof item.color === "string" ? { color: item.color } : {}),
        ...(item.lineStyle === "dashed" ? { lineStyle: "dashed" as const } : {}),
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value && value.data.length));
  if (!series.length) return null;

  const rawLabels = source.labels ?? source.x_axis ?? source.xAxis ?? source.categories;
  const labels = Array.isArray(rawLabels)
    ? rawLabels.map((label, index) => String(label ?? index))
    : Array.from({ length: Math.max(...series.map((item) => item.data.length)) }, (_, index) => String(index + 1));
  if (!labels.length) return null;

  const validChartTypes = ["line", "bar", "area", "pie", "radar", "scatter", "composed", "funnel", "radial"] as const;
  const chartType = validChartTypes.includes(source.chartType as (typeof validChartTypes)[number])
    ? source.chartType as ChartToolPayload["chartType"]
    : "line";
  return {
    chartType,
    labels,
    series,
    ...(typeof source.title === "string" ? { title: source.title } : {}),
    ...(typeof source.description === "string" ? { description: source.description } : {}),
    ...(source.layout === "horizontal" ? { layout: "horizontal" as const } : {}),
    ...(typeof source.stacked === "boolean" ? { stacked: source.stacked } : {}),
    ...(Array.isArray(source.colors) ? { colors: source.colors.filter((color): color is string => typeof color === "string") } : {}),
    ...(source.valueFormatter === "currency" || source.valueFormatter === "percent" || source.valueFormatter === "compact" || source.valueFormatter === "none"
      ? { valueFormatter: source.valueFormatter }
      : {}),
    ...(Array.isArray(source.seriesKinds) ? { seriesKinds: source.seriesKinds.filter((kind): kind is "line" | "bar" | "area" => kind === "line" || kind === "bar" || kind === "area") } : {}),
  };
}

function useChartThemeColors() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return {
    grid: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
    axis: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.4)",
    tooltipBg: isDark ? "rgba(10, 10, 10, 0.8)" : "rgba(255, 255, 255, 0.9)",
    tooltipBorder: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
    label: isDark ? "rgba(255, 255, 255, 0.9)" : "rgba(0, 0, 0, 0.9)",
  };
}

function pickSeriesColor(
  index: number,
  seriesColor: string | undefined,
  palette: string[] | undefined
): string {
  return (
    seriesColor ??
    palette?.[index] ??
    DEFAULT_SERIES_COLORS[index % DEFAULT_SERIES_COLORS.length]
  );
}

function buildRows(spec: ChartToolPayload) {
  return spec.labels.map((name, i) => {
    const row: Record<string, string | number> = { name };
    for (const s of spec.series) {
      row[s.name] = s.data[i] ?? 0;
    }
    return row;
  });
}

function buildRadarData(spec: ChartToolPayload) {
  return spec.labels.map((subject, i) => {
    const row: Record<string, string | number> = { subject };
    for (const s of spec.series) {
      row[s.name] = s.data[i] ?? 0;
    }
    return row;
  });
}

function buildPieData(spec: ChartToolPayload) {
  const s0 = spec.series[0];
  return spec.labels.map((name, i) => ({
    name,
    value: s0.data[i] ?? 0,
    fill: pickSeriesColor(i, undefined, spec.colors),
  }));
}

function buildFunnelData(spec: ChartToolPayload) {
  const s0 = spec.series[0];
  return spec.labels.map((name, i) => ({
    name,
    value: s0.data[i] ?? 0,
    fill: pickSeriesColor(i, undefined, spec.colors),
  }));
}

const formatValue = (
  value: any,
  formatterType?: "currency" | "percent" | "compact" | "none"
) => {
  if (typeof value !== "number") {
    return value;
  }
  switch (formatterType) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
    case "percent":
      return new Intl.NumberFormat("en-US", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(value / 100);
    case "compact":
      return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    default:
      return value.toLocaleString("en-US");
  }
};

function buildScatterSeries(spec: ChartToolPayload): {
  key: string;
  name: string;
  color: string;
  points: { x: number; y: number; label: string }[];
}[] {
  const L = spec.labels.length;
  return spec.series.map((s, j) => ({
    key: s.name,
    name: s.name,
    color: pickSeriesColor(j, s.color, spec.colors),
    points: Array.from({ length: L }, (_, i) => ({
      x: i,
      y: s.data[i] ?? 0,
      label: spec.labels[i] ?? String(i),
    })),
  }));
}

export function ChartDisplay({ spec: input, className }: ChartDisplayProps) {
  const colors = useChartThemeColors();
  const spec = normalizeChartSpec(input);
  if (!spec) {
    return (
      <div className={cn("flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground", className)}>
        Chart data is unavailable.
      </div>
    );
  }
  const rows = buildRows(spec);
  const radarData = buildRadarData(spec);
  const pieData = buildPieData(spec);
  const scatterSeries = buildScatterSeries(spec);
  const funnelData = spec.chartType === "funnel" ? buildFunnelData(spec) : [];
  const radialData = spec.chartType === "radial" ? buildPieData(spec) : [];

  const commonMargin = { top: 8, right: 8, left: 0, bottom: 8 };
  const xAxisTick = { fill: colors.axis, fontSize: 10 };
  const yAxisTick = { fill: colors.axis, fontSize: 10 };

  const tooltipContentStyle = {
    borderRadius: 12,
    border: `1px solid ${colors.tooltipBorder}`,
    background: colors.tooltipBg,
    backdropFilter: "blur(12px)",
    color: colors.label,
    fontSize: 12,
    padding: "8px 12px",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    maxWidth: "min(92vw, 280px)",
  };

  const legendProps = {
    wrapperStyle: {
      fontSize: 11,
      paddingTop: 8,
      display: "flex",
      flexWrap: "wrap" as const,
      justifyContent: "center" as const,
      gap: 8,
    },
  };

  const isHorizontal = spec.layout === "horizontal";
  const stacking = spec.stacked ? "1" : undefined;

  const xAxisProps = {
    dataKey: isHorizontal ? undefined : "name",
    stroke: colors.grid,
    tick: { fill: colors.axis, fontSize: 10 },
    tickLine: { stroke: colors.grid },
    axisLine: { stroke: colors.grid },
    type: (isHorizontal ? "number" : "category") as "number" | "category",
  };

  const yAxisProps = {
    stroke: colors.grid,
    tick: { fill: colors.axis, fontSize: 10 },
    tickLine: { stroke: colors.grid },
    axisLine: { stroke: colors.grid },
    width: isHorizontal ? 80 : 40,
    type: (isHorizontal ? "category" : "number") as "number" | "category",
    dataKey: isHorizontal ? "name" : undefined,
    tickFormatter: (val: any) =>
      formatValue(val, isHorizontal ? "none" : spec.valueFormatter),
  };

  const chartInner = (() => {
    switch (spec.chartType) {
      case "line":
        return (
          <LineChart data={rows} layout={spec.layout} margin={commonMargin}>
            <CartesianGrid
              horizontal={!isHorizontal}
              stroke={colors.grid}
              strokeDasharray="3 3"
              vertical={isHorizontal}
            />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip
              contentStyle={tooltipContentStyle}
              cursor={{ stroke: colors.grid, strokeWidth: 1 }}
              formatter={(value: any) =>
                formatValue(value, spec.valueFormatter)
              }
            />
            <Legend {...legendProps} />
            <defs>
              {spec.series.map((s, i) => {
                const c = pickSeriesColor(i, s.color, spec.colors);
                return (
                  <linearGradient
                    id={`lineGradient-${i}`}
                    key={i}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={c} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={c} stopOpacity={0} />
                  </linearGradient>
                );
              })}
            </defs>
            {spec.series.map((s, i) => (
              <Line
                activeDot={{ r: 5, strokeWidth: 0 }}
                animationDuration={1500}
                dataKey={s.name}
                dot={{
                  r: 3,
                  fill: pickSeriesColor(i, s.color, spec.colors),
                  strokeWidth: 2,
                  stroke: "#000",
                }}
                key={`${s.name}-${i}`}
                stroke={pickSeriesColor(i, s.color, spec.colors)}
                strokeDasharray={s.lineStyle === "dashed" ? "5 5" : undefined}
                strokeWidth={3}
                type="natural"
              />
            ))}
          </LineChart>
        );

      case "bar":
        return (
          <BarChart data={rows} layout={spec.layout} margin={commonMargin}>
            <CartesianGrid
              horizontal={!isHorizontal}
              stroke={colors.grid}
              strokeDasharray="3 3"
              vertical={isHorizontal}
            />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip
              contentStyle={tooltipContentStyle}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
              formatter={(value: any) =>
                formatValue(value, spec.valueFormatter)
              }
            />
            <Legend {...legendProps} />
            <defs>
              {spec.series.map((s, i) => {
                const c = pickSeriesColor(i, s.color, spec.colors);
                return (
                  <linearGradient
                    id={`barGradient-${i}`}
                    key={i}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={c} stopOpacity={1} />
                    <stop offset="100%" stopColor={c} stopOpacity={0.6} />
                  </linearGradient>
                );
              })}
            </defs>
            {spec.series.map((s, i) => (
              <Bar
                animationDuration={1500}
                dataKey={s.name}
                fill={`url(#barGradient-${i})`}
                key={`${s.name}-${i}`}
                radius={isHorizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
                stackId={stacking}
              />
            ))}
          </BarChart>
        );

      case "area":
        return (
          <AreaChart data={rows} layout={spec.layout} margin={commonMargin}>
            <CartesianGrid
              horizontal={!isHorizontal}
              stroke={colors.grid}
              strokeDasharray="3 3"
              vertical={isHorizontal}
            />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip
              contentStyle={tooltipContentStyle}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
              formatter={(value: any) =>
                formatValue(value, spec.valueFormatter)
              }
            />
            <Legend {...legendProps} />
            <defs>
              {spec.series.map((s, i) => {
                const c = pickSeriesColor(i, s.color, spec.colors);
                return (
                  <linearGradient
                    id={`areaGradient-${i}`}
                    key={i}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={c} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={c} stopOpacity={0} />
                  </linearGradient>
                );
              })}
            </defs>
            {spec.series.map((s, i) => {
              const c = pickSeriesColor(i, s.color, spec.colors);
              return (
                <Area
                  animationDuration={1500}
                  dataKey={s.name}
                  fill={`url(#areaGradient-${i})`}
                  key={`${s.name}-${i}`}
                  stackId={stacking}
                  stroke={c}
                  strokeWidth={2}
                  type="natural"
                />
              );
            })}
          </AreaChart>
        );

      case "pie":
        return (
          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Pie
              cx="50%"
              cy="50%"
              data={pieData}
              dataKey="value"
              innerRadius="42%"
              label={({ name, percent }) =>
                `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
              }
              labelLine={{ stroke: colors.axis }}
              nameKey="name"
              outerRadius="72%"
              paddingAngle={2}
            >
              {pieData.map((entry, index) => (
                <Cell
                  fill={pickSeriesColor(index, undefined, spec.colors)}
                key={`${entry.name}-${index}`}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipContentStyle}
              formatter={(value: any) =>
                formatValue(value, spec.valueFormatter)
              }
            />
            <Legend {...legendProps} />
          </PieChart>
        );

      case "radar":
        return (
          <RadarChart data={radarData} margin={commonMargin}>
            <PolarGrid stroke={colors.grid} />
            <PolarAngleAxis
              dataKey="subject"
              stroke={colors.axis}
              tick={{ fill: colors.axis, fontSize: 10 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, "auto"]}
              stroke={colors.axis}
              tick={{ fill: colors.axis, fontSize: 9 }}
            />
            <Tooltip
              contentStyle={tooltipContentStyle}
              formatter={(value: any) =>
                formatValue(value, spec.valueFormatter)
              }
            />
            <Legend {...legendProps} />
            {spec.series.map((s, i) => (
              <Radar
                dataKey={s.name}
                fill={pickSeriesColor(i, s.color, spec.colors)}
                fillOpacity={0.35}
                key={`${s.name}-${i}`}
                stroke={pickSeriesColor(i, s.color, spec.colors)}
                strokeWidth={2}
              />
            ))}
          </RadarChart>
        );

      case "scatter":
        return (
          <ScatterChart margin={{ top: 8, right: 12, bottom: 24, left: 8 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis
              domain={[0, Math.max(spec.labels.length - 1, 0)]}
              stroke={colors.axis}
              tick={{ ...xAxisTick }}
              tickFormatter={(v) => spec.labels[v as number] ?? ""}
              type="number"
            />
            <YAxis
              stroke={colors.axis}
              tick={yAxisTick}
              tickMargin={4}
              width={40}
            />
            <Tooltip
              contentStyle={tooltipContentStyle}
              formatter={(value: any) =>
                formatValue(value, spec.valueFormatter)
              }
            />
            <Legend {...legendProps} />
            {scatterSeries.map((ss, i) => (
              <Scatter
                data={ss.points}
                dataKey="y"
                fill={ss.color}
                key={`${ss.key}-${i}`}
                name={ss.name}
              />
            ))}
          </ScatterChart>
        );

      case "composed": {
        const kinds = spec.seriesKinds ?? [];
        return (
          <ComposedChart data={rows} margin={commonMargin}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              interval="preserveStartEnd"
              stroke={colors.axis}
              tick={xAxisTick}
              tickMargin={6}
            />
            <YAxis
              stroke={colors.axis}
              tick={yAxisTick}
              tickMargin={4}
              width={40}
            />
            <Tooltip
              contentStyle={tooltipContentStyle}
              formatter={(value: any) =>
                formatValue(value, spec.valueFormatter)
              }
            />
            <Legend {...legendProps} />
            {spec.series.map((s, i) => {
              const c = pickSeriesColor(i, s.color, spec.colors);
              const kind = kinds[i] ?? "bar";
              if (kind === "line") {
                return (
                  <Line
                    dataKey={s.name}
                    dot={false}
                    key={`${s.name}-${i}`}
                    stroke={c}
                    strokeWidth={2}
                    type="natural"
                  />
                );
              }
              if (kind === "area") {
                return (
                  <Area
                    dataKey={s.name}
                    fill={c}
                    fillOpacity={0.3}
                    key={`${s.name}-${i}`}
                    stroke={c}
                    type="natural"
                  />
                );
              }
              return (
                <Bar
                  dataKey={s.name}
                  fill={c}
                  key={`${s.name}-${i}`}
                  radius={[3, 3, 0, 0]}
                />
              );
            })}
          </ComposedChart>
        );
      }

      case "radial":
        return (
          <RadialBarChart
            barSize={16}
            cx="50%"
            cy="50%"
            data={radialData}
            innerRadius="20%"
            outerRadius="80%"
          >
            <PolarAngleAxis
              angleAxisId={0}
              domain={[0, "dataMax"]}
              tick={false}
              type="number"
            />
            <RadialBar
              background={{ fill: colors.grid }}
              cornerRadius={8}
              dataKey="value"
            >
              {radialData.map((entry, index) => (
                <Cell fill={entry.fill} key={`cell-${index}`} />
              ))}
            </RadialBar>
            <Legend {...legendProps} />
            <Tooltip
              contentStyle={tooltipContentStyle}
              formatter={(value: any) =>
                formatValue(value, spec.valueFormatter)
              }
            />
          </RadialBarChart>
        );

      case "funnel":
        return (
          <FunnelChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
            <Tooltip
              contentStyle={tooltipContentStyle}
              formatter={(value: any) =>
                formatValue(value, spec.valueFormatter)
              }
            />
            <Funnel data={funnelData} dataKey="value" isAnimationActive>
              <LabelList
                dataKey="name"
                fill={colors.axis}
                fontSize={12}
                position="right"
                stroke="none"
              />
              {funnelData.map((entry, index) => (
                <Cell fill={entry.fill} key={`cell-${index}`} />
              ))}
            </Funnel>
          </FunnelChart>
        );

      default:
        return null;
    }
  })();

  return (
    <div
      className={cn(
        "not-prose w-full overflow-hidden rounded-xl bg-transparent p-1 sm:p-2",
        className
      )}
    >
      {spec.title ? (
        <h3 className="mb-1 px-1 font-semibold text-foreground text-sm sm:text-base">
          {spec.title}
        </h3>
      ) : null}
      {spec.description ? (
        <p className="mb-2 px-1 text-muted-foreground text-xs sm:text-sm">
          {spec.description}
        </p>
      ) : null}
      <div className="h-[260px] min-h-[1px] min-w-[1px] w-full overflow-hidden sm:h-[300px] md:h-[min(52vh,340px)] md:min-h-[280px]">
        <SafeResponsiveContainer minHeight={260}>
          {chartInner}
        </SafeResponsiveContainer>
      </div>
    </div>
  );
}
