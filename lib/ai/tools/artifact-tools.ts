import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { createDocument } from "./create-document";

type Props = Parameters<typeof createDocument>[0];

const chartSpecSchema = z.object({
  chartType: z.enum([
    "line",
    "bar",
    "area",
    "pie",
    "radar",
    "scatter",
    "composed",
    "funnel",
    "radial",
  ]),
  title: z.string().optional(),
  description: z.string().optional(),
  labels: z.array(z.string()).min(1),
  series: z.array(
    z.object({
      name: z.string().min(1),
      data: z.array(z.number()),
      color: z.string().optional(),
    })
  ).min(1),
  valueFormatter: z.enum(["currency", "percent", "compact", "none"]).optional(),
  colors: z.array(z.string()).optional(),
});

const tableSchema = z.object({
  headers: z.array(z.string()).min(1),
  rows: z.array(z.array(z.union([z.string(), z.number()]))),
});

const visualSchema = z.object({
  url: z.string().url().optional(),
  prompt: z.string().optional(),
  alt: z.string().optional(),
});

const baseInput = {
  title: z.string().min(1).describe("A concise human-readable artifact title"),
  prompt: z.string().min(10).describe("The complete content and design brief"),
  audience: z.string().optional().describe("The intended reader or user"),
  style: z
    .string()
    .optional()
    .describe("The visual, editorial, or brand direction"),
  data: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Structured source data"),
};

export const createPresentation = ({ session, dataStream, modelId }: Props) => {
  const documentTool = createDocument({ session, dataStream, modelId });
  return tool({
    description:
      "Create one editable presentation deck with varied slide layouts, charts, visuals, speaker notes, and a coherent narrative. When a slide needs a generated image, call generateImage first, then pass its returned public URL in visuals[].url so the image is embedded in the saved deck.",
    inputSchema: z.object({
      ...baseInput,
      kind: z.literal("presentation").default("presentation"),
      charts: z.array(chartSpecSchema).max(8).optional(),
      tables: z.array(tableSchema).max(8).optional(),
      visuals: z.array(visualSchema).max(8).optional(),
    }),
    execute: async ({ charts, tables, visuals, ...input }) =>
      documentTool.execute?.(
        {
          ...input,
          kind: "presentation",
          data: { ...(input.data ?? {}), charts, tables, visuals },
        },
        {} as never
      ),
  });
};

export const createPdf = ({ session, dataStream, modelId }: Props) => {
  const documentTool = createDocument({ session, dataStream, modelId });
  return tool({
    description:
      "Create one print-ready, multi-page PDF document with headings, paragraphs, lists, tables, charts, citations, page flow, and a selected color theme.",
    inputSchema: z.object({
      ...baseInput,
      kind: z.literal("pdf").default("pdf"),
      theme: z
        .enum(["forest", "ocean", "plum", "cobalt", "terracotta", "slate"])
        .optional(),
      charts: z.array(chartSpecSchema).max(8).optional(),
      tables: z.array(tableSchema).max(12).optional(),
    }),
    execute: async ({ theme, charts, tables, ...input }) =>
      documentTool.execute?.(
        {
          ...input,
          kind: "pdf",
          style: `${input.style ?? ""}\nPDF theme: ${theme ?? "forest"}`,
          data: { ...(input.data ?? {}), charts, tables },
        },
        {} as never
      ),
  });
};

export const createDashboard = ({ session, dataStream, modelId }: Props) => {
  const documentTool = createDocument({ session, dataStream, modelId });
  return tool({
    description:
      "Create one interactive dashboard with KPI cards, chart-ready time series, comparison metrics, filters, tables, annotations, and a readable visual hierarchy.",
    inputSchema: z.object({
      ...baseInput,
      kind: z.literal("dashboard").default("dashboard"),
      metrics: z.array(z.string()).optional(),
      charts: z.array(chartSpecSchema).max(8).optional(),
      filters: z.array(z.string()).optional(),
      dateRange: z.string().optional(),
    }),
    execute: async ({ metrics, charts, filters, dateRange, ...input }) =>
      documentTool.execute?.(
        {
          ...input,
          kind: "dashboard",
          data: { ...(input.data ?? {}), metrics, charts, filters, dateRange },
        },
        {} as never
      ),
  });
};

export const createPlanner = ({ session, dataStream, modelId }: Props) => {
  const documentTool = createDocument({ session, dataStream, modelId });
  return tool({
    description:
      "Create one editable planner with calendar events, priorities, deadlines, buffers, notes, tags, and week or month organization.",
    inputSchema: z.object({
      ...baseInput,
      kind: z.literal("planner").default("planner"),
      period: z.enum(["week", "month", "quarter"]).optional(),
      startDate: z.string().optional(),
    }),
    execute: async ({ period, startDate, ...input }) =>
      documentTool.execute?.(
        {
          ...input,
          kind: "planner",
          data: { ...(input.data ?? {}), period, startDate },
        },
        {} as never
      ),
  });
};

export type ArtifactToolSession = Session;
