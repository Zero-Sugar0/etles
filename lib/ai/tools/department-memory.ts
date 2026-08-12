/**
 * Department-scoped shared memory for sub-agent collaboration.
 * Agents in the same department (operations, sales, engineering, etc.)
 * read/write a shared vector namespace so project context compounds.
 */

import { Index } from "@upstash/vector";
import { tool } from "ai";
import { z } from "zod";
import { getAgentDepartment } from "@/lib/agent/departments";

function getDepartmentNamespace(userId: string, department: string) {
  const index = new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL!,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
  });
  return index.namespace(`dept-${department}-${userId}`);
}

function getSharedNamespace(userId: string) {
  const index = new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL!,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
  });
  return index.namespace(`shared-${userId}`);
}

const DEPARTMENTS = [
  "executive_ops", "sales", "marketing", "engineering", "product", "finance",
  "customer_service", "hr_people", "growth_analytics", "research_strategy",
  "security", "legal_compliance", "content_creative", "supply_chain_ecommerce",
  "partnerships_alliances", "general",
] as const;

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
        .describe(
          "Semantic search query, e.g. 'Q3 launch blockers' or 'client Acme status'"
        ),
      topK: z.number().min(1).max(15).optional().default(8),
    }),
    execute: async ({ query, topK }) => {
      const department = getAgentDepartment(agentSlug);
      try {
        // Search the department and user-wide shared memory. The all-department
        // lookup also makes older entries discoverable before they are mirrored.
        const results = await Promise.all(
          DEPARTMENTS.map((name) =>
            getDepartmentNamespace(userId, name)
              .query({ data: query, topK, includeMetadata: true })
              .catch(() => [])
          )
        );
        const sharedResults = await getSharedNamespace(userId)
          .query({ data: query, topK, includeMetadata: true })
          .catch(() => []);
        const entries = [...results.flat(), ...sharedResults].map((r) => ({
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
        .describe(
          "Short unique key, e.g. 'project-alpha-status' or 'acme-deal-notes'"
        ),
      content: z
        .string()
        .describe("Dense markdown or plain text to share with the department"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Optional tags for filtering"),
    }),
    execute: async ({ key, content, tags }) => {
      const department = getAgentDepartment(agentSlug);
      try {
        const metadata = {
          key,
          content,
          department,
          savedBy: agentSlug,
          tags: (tags ?? []).join(","),
          savedAt: new Date().toISOString(),
        };
        await Promise.all([
          getDepartmentNamespace(userId, department).upsert({
            id: key,
            data: content,
            metadata,
          }),
          getSharedNamespace(userId).upsert({
            id: `${department}:${key}`,
            data: content,
            metadata,
          }),
        ]);
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
