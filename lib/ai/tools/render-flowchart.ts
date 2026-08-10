import { tool } from "ai";
import { z } from "zod";

const flowchartNodeSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe("Unique node identifier (e.g. 'A', 'start', 'process_1')."),
  label: z.string().min(1).describe("Display label text for the node."),
  type: z
    .enum([
      "rect",
      "rounded",
      "diamond",
      "circle",
      "stadium",
      "trapezoid",
      "parallelogram",
    ])
    .optional()
    .describe("Visual shape of the node. Defaults to 'rounded'."),
  color: z
    .string()
    .optional()
    .describe(
      "Optional CSS color for the node fill (e.g. '#4ade80', 'hsl(158 94% 30%)')."
    ),
});

const flowchartEdgeSchema = z.object({
  from: z.string().min(1).describe("Source node ID."),
  to: z.string().min(1).describe("Target node ID."),
  label: z.string().optional().describe("Optional edge label text."),
  style: z
    .enum(["solid", "dashed", "thick", "dotted"])
    .optional()
    .describe("Line style. Defaults to 'solid'."),
});

export const flowchartToolInputSchema = z.object({
  title: z
    .string()
    .optional()
    .describe("Optional title displayed above the flowchart."),
  description: z
    .string()
    .optional()
    .describe("Optional description below the title."),
  direction: z
    .enum(["TB", "LR", "RL", "BT"])
    .optional()
    .describe(
      "Flowchart direction: TB (top-to-bottom), LR (left-to-right), RL (right-to-left), BT (bottom-to-top). Defaults to 'TB'."
    ),
  nodes: z
    .array(flowchartNodeSchema)
    .min(1)
    .max(50)
    .describe("Nodes in the flowchart."),
  edges: z
    .array(flowchartEdgeSchema)
    .min(1)
    .max(100)
    .describe("Connections between nodes."),
});

export type FlowchartToolPayload = z.infer<typeof flowchartToolInputSchema>;

/**
 * Converts a node type to the mermaid node shape syntax.
 */
function nodeTypeToMermaid(type: string | undefined): string {
  switch (type) {
    case "rect":
      return "[]";
    case "rounded":
      return "()";
    case "diamond":
      return "{}";
    case "circle":
      return "(())";
    case "stadium":
      return "([])";
    case "trapezoid":
      return "[/\\]";
    case "parallelogram":
      return "[/]";
    default:
      return "[]";
  }
}

/**
 * Converts an edge style to the mermaid link style.
 */
function edgeStyleToMermaid(style: string | undefined): string {
  switch (style) {
    case "dashed":
      return "-.->";
    case "thick":
      return "==>";
    case "dotted":
      return "-..->";
    default:
      return "-->";
  }
}

/**
 * Builds a mermaid flowchart definition from structured node/edge data.
 */
function buildMermaidFlowchart(input: FlowchartToolPayload): string {
  const direction = input.direction ?? "TB";
  const lines: string[] = [`flowchart ${direction}`];

  // Mermaid node IDs must be identifier-safe and unique, even when labels come from tools.
  const declared = new Set<string>();
  const safeIds = new Map<string, string>();
  for (const [index, node] of input.nodes.entries()) {
    const base = node.id.replace(/[^a-zA-Z0-9_]/g, "_") || `node_${index + 1}`;
    let safeId = base;
    let suffix = 2;
    while (safeIds.has(safeId)) safeId = `${base}_${suffix++}`;
    safeIds.set(node.id, safeId);
  }

  for (const node of input.nodes) {
    const safeId = safeIds.get(node.id);
    if (!safeId || declared.has(safeId)) continue;
    declared.add(safeId);

    const shape = nodeTypeToMermaid(node.type);
    const half = Math.floor(shape.length / 2);
    const open = shape.slice(0, half);
    const close = shape.slice(half);

    const label = node.label.replace(/"/g, "#quot;");
    const colorSuffix = node.color ? `:::${safeId}_style` : "";
    lines.push(`    ${safeId}${open}"${label}"${close}${colorSuffix}`);
  }

  for (const edge of input.edges) {
    const link = edgeStyleToMermaid(edge.style);
    const labelSuffix = edge.label
      ? `|${edge.label.replace(/"/g, "#quot;")}|`
      : "";
    const from = safeIds.get(edge.from);
    const to = safeIds.get(edge.to);
    if (from && to) lines.push(`    ${from} ${labelSuffix}${link} ${to}`);
  }

  // Add style definitions for colored nodes
  for (const node of input.nodes) {
    if (node.color) {
      lines.push(
        `    style ${safeIds.get(node.id)} fill:${node.color},stroke:${node.color},color:#fff`
      );
    }
  }

  return lines.join("\n");
}

export const renderFlowchart = tool({
  description:
    "Render a flowchart diagram. Provide structured nodes and edges, and the tool converts them into a visual flowchart. Use this when the user asks for a process flow, decision tree, workflow, algorithm visualization, or step-by-step diagram.",
  inputSchema: flowchartToolInputSchema,
  execute: (input) => {
    const parsed = flowchartToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const form = parsed.error.flatten().formErrors.join("; ");
      return {
        error:
          form ||
          "Invalid flowchart input. Check node IDs, labels, and edge connections.",
      };
    }

    // Validate that all edge references point to existing nodes
    const nodeIds = new Set(parsed.data.nodes.map((n) => n.id));
    for (const edge of parsed.data.edges) {
      if (!nodeIds.has(edge.from)) {
        return {
          error: `Edge references unknown node '${edge.from}'. Valid nodes: ${Array.from(nodeIds).join(", ")}`,
        };
      }
      if (!nodeIds.has(edge.to)) {
        return {
          error: `Edge references unknown node '${edge.to}'. Valid nodes: ${Array.from(nodeIds).join(", ")}`,
        };
      }
    }

    const chart = buildMermaidFlowchart(parsed.data);

    return {
      chart,
      title: parsed.data.title,
      description: parsed.data.description,
    };
  },
});
