/**
 * Department-scoped shared memory for sub-agent collaboration.
 * Agents in the same department (operations, sales, engineering, etc.)
 * read/write a shared vector namespace so project context compounds.
 */

import { tool } from "ai";
import { z } from "zod";
import { Index } from "@upstash/vector";
import { getAgentDepartment } from "@/lib/agent/departments";

function getDepartmentNamespace(userId: string, department: string) {
  const index = new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL!,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
  });
  return index.namespace(`dept-${department}-${userId}`);
}

export const readDepartmentMemory = ({
  userId,
  agentSlug,
}: {
  userId: string;
  agentSlug: string;
}) =>
  tool({
    description:
      "Read shared memory for your department. Other agents in the same department " +
      "(e.g. project_manager + chief_of_staff in Operations) can see what you save here. " +
      "Use at the start of project work to load prior decisions, blockers, and context.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("Semantic search query, e.g. 'Q3 launch blockers' or 'client Acme status'"),
      topK: z.number().min(1).max(15).optional().default(8),
    }),
    execute: async ({ query, topK }) => {
      const department = getAgentDepartment(agentSlug);
      try {
        const ns = getDepartmentNamespace(userId, department);
        const results = await ns.query({
          data: query,
          topK,
          includeMetadata: true,
        });
        const entries = results.map((r) => ({
          key: (r.metadata as Record<string, string>)?.key ?? r.id,
          content: (r.metadata as Record<string, string>)?.content ?? "",
          savedBy: (r.metadata as Record<string, string>)?.savedBy ?? "unknown",
          savedAt: (r.metadata as Record<string, string>)?.savedAt ?? "",
        }));
        return {
          success: true,
          department,
          entries,
          message:
            entries.length > 0
              ? `Found ${entries.length} shared entries in ${department} department memory.`
              : `No shared entries matched. Department: ${department}.`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

export const writeDepartmentMemory = ({
  userId,
  agentSlug,
}: {
  userId: string;
  agentSlug: string;
}) =>
  tool({
    description:
      "Save knowledge to your department's shared memory so collaborating agents can reuse it. " +
      "Use for project status, decisions, blockers, stakeholder notes — anything the department should share.",
    inputSchema: z.object({
      key: z
        .string()
        .describe("Short unique key, e.g. 'project-alpha-status' or 'acme-deal-notes'"),
      content: z.string().describe("Dense markdown or plain text to share with the department"),
      tags: z.array(z.string()).optional().describe("Optional tags for filtering"),
    }),
    execute: async ({ key, content, tags }) => {
      const department = getAgentDepartment(agentSlug);
      try {
        const ns = getDepartmentNamespace(userId, department);
        await ns.upsert({
          id: key,
          data: content,
          metadata: {
            key,
            content,
            department,
            savedBy: agentSlug,
            tags: (tags ?? []).join(","),
            savedAt: new Date().toISOString(),
          },
        });
        return {
          success: true,
          department,
          key,
          message: `Saved to ${department} department memory. Other agents in this department can recall it.`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
