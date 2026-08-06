import { tool } from "ai";
import { z } from "zod";

/**
 * Known mermaid diagram type prefixes. Used to validate that the chart
 * string starts with a recognized diagram type.
 */
const MERMAID_DIAGRAM_TYPES = [
  "flowchart",
  "graph",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "gantt",
  "pie",
  "pie showData",
  "journey",
  "gitgraph",
  "gitGraph",
  "mindmap",
  "timeline",
  "zenuml",
  "sankey-beta",
  "xychart-beta",
  "block",
  "packet",
  "quadrantChart",
  "requirementDiagram",
  "c4context",
  "c4container",
  "c4component",
  "c4dynamic",
  "c4deployment",
  "info",
];

export const mermaidToolInputSchema = z.object({
  chart: z
    .string()
    .min(1)
    .describe(
      "The mermaid diagram definition. Must start with a valid diagram type keyword (e.g. 'flowchart TD', 'sequenceDiagram', 'graph LR', 'gantt', 'pie', 'erDiagram', 'classDiagram', 'stateDiagram', 'journey', 'gitgraph', 'mindmap', 'timeline', 'block', 'packet', 'quadrantChart', 'requirementDiagram', 'c4context', etc.). Use proper mermaid syntax with indentation and line breaks."
    ),
  title: z
    .string()
    .optional()
    .describe("Optional title displayed above the diagram."),
  description: z
    .string()
    .optional()
    .describe("Optional description or caption displayed below the title."),
});

export type MermaidToolPayload = z.infer<typeof mermaidToolInputSchema>;

function detectDiagramType(chart: string): string | null {
  const firstLine = chart.trim().split("\n")[0]?.trim() ?? "";
  const firstWord = firstLine.split(/\s+/)[0] ?? "";
  return (
    MERMAID_DIAGRAM_TYPES.find(
      (t) => firstWord.toLowerCase() === t.toLowerCase()
    ) ?? null
  );
}

export const renderMermaid = tool({
  description:
    "Render a diagram or flowchart using Mermaid syntax. Supports: flowcharts, sequence diagrams, class diagrams, state diagrams, ER diagrams, Gantt charts, pie charts, user journeys, git graphs, mindmaps, timelines, block diagrams, quadrant charts, requirement diagrams, C4 diagrams, and more. Use this when the user asks for a visual diagram, flowchart, architecture overview, process map, or any structured visual.",
  inputSchema: mermaidToolInputSchema,
  execute: (input) => {
    const parsed = mermaidToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const form = parsed.error.flatten().formErrors.join("; ");
      return {
        error:
          form ||
          "Invalid mermaid input. Provide a valid mermaid diagram definition.",
      };
    }

    const type = detectDiagramType(parsed.data.chart);
    if (!type) {
      return {
        error: `Could not detect a known mermaid diagram type. The chart must start with one of: ${MERMAID_DIAGRAM_TYPES.join(", ")}.`,
      };
    }

    return parsed.data;
  },
});
