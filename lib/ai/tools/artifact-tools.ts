import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { createDocument } from "./create-document";

type Props = Parameters<typeof createDocument>[0];

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
      "Create one editable presentation deck with varied slide layouts, charts, visuals, speaker notes, and a coherent narrative.",
    inputSchema: z.object({
      ...baseInput,
      kind: z.literal("presentation").default("presentation"),
    }),
    execute: async (input) =>
      documentTool.execute?.({ ...input, kind: "presentation" }, {} as never),
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
    }),
    execute: async ({ theme, ...input }) =>
      documentTool.execute?.(
        {
          ...input,
          kind: "pdf",
          style: `${input.style ?? ""}\nPDF theme: ${theme ?? "forest"}`,
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
      chartType: z.enum(["bar", "line", "area", "donut"]).optional(),
    }),
    execute: async ({ metrics, chartType, ...input }) =>
      documentTool.execute?.(
        {
          ...input,
          kind: "dashboard",
          data: { ...(input.data ?? {}), metrics, chartType },
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
