import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMermaidChart } from "../lib/ai/tools/render-mermaid";

test("normalizeMermaidChart strips markdown fences and trims whitespace", () => {
  const input = "\n```mermaid\nflowchart TD\n  A-->B\n```\n";

  assert.equal(normalizeMermaidChart(input), "flowchart TD\n  A-->B");
});

test("normalizeMermaidChart preserves diagram content when no fence is present", () => {
  const input = "\nflowchart LR\n  A[Start] --> B[End]\n";

  assert.equal(normalizeMermaidChart(input), "flowchart LR\n  A[Start] --> B[End]");
});
