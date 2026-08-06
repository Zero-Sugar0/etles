/**
 * Agent skill reader — lets Etles read built-in skills from .agents/skills/
 * (composio, chat-sdk, etles-agent, etc.) without relying only on the wiki.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";

const SKILLS_ROOT = path.join(process.cwd(), ".agents", "skills");
const MAX_READ_CHARS = 32_000;

async function listSkillSlugs(): Promise<string[]> {
  try {
    const entries = await fs.readdir(SKILLS_ROOT, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function safeSkillPath(slug: string): string | null {
  const resolved = path.resolve(SKILLS_ROOT, slug, "SKILL.md");
  if (!resolved.startsWith(SKILLS_ROOT + path.sep)) {
    return null;
  }
  return resolved;
}

async function readSkillFile(slug: string): Promise<string | null> {
  const filePath = safeSkillPath(slug);
  if (!filePath) {
    return null;
  }
  try {
    const content = await fs.readFile(filePath, "utf-8");
    if (content.length > MAX_READ_CHARS) {
      return `${content.slice(0, MAX_READ_CHARS)}\n\n[...truncated at ${MAX_READ_CHARS} chars]`;
    }
    return content;
  } catch {
    return null;
  }
}

async function listRuleFiles(slug: string): Promise<string[]> {
  const rulesDir = path.resolve(SKILLS_ROOT, slug, "rules");
  try {
    const entries = await fs.readdir(rulesDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

export const readAgentSkill = () =>
  tool({
    description:
      "Read built-in Etles agent skills from the .agents/skills folder. " +
      "Use action='index' first to list available skills (composio, chat-sdk, etles-agent, etc.), " +
      "then action='read' with a slug to load SKILL.md. Use action='read_rule' for a specific rule file. " +
      "Prefer this over wikiQuery when you need integration guides, webhook setup, or platform-specific instructions.",
    inputSchema: z.object({
      action: z
        .enum(["index", "read", "read_rule"])
        .describe(
          "'index' lists skills. 'read' loads SKILL.md. 'read_rule' loads a rules/*.md file."
        ),
      slug: z
        .string()
        .optional()
        .describe(
          "Skill folder name, e.g. 'composio', 'chat-sdk', 'etles-agent'. Required for read/read_rule."
        ),
      rule: z
        .string()
        .optional()
        .describe(
          "Rule filename for read_rule, e.g. 'tr-session-basic.md'. Omit to list rules for a slug."
        ),
    }),
    execute: async ({ action, slug, rule }) => {
      if (action === "index") {
        const slugs = await listSkillSlugs();
        const summaries = await Promise.all(
          slugs.map(async (s) => {
            const content = await readSkillFile(s);
            const firstLine =
              content
                ?.split("\n")
                .find(
                  (l) =>
                    l.startsWith("description:") ||
                    l.startsWith("description >")
                )
                ?.replace(/^description:?\s*>?\s*/, "")
                ?.trim() ?? "";
            return {
              slug: s,
              description: firstLine || "Built-in agent skill",
            };
          })
        );
        return {
          success: true,
          skills: summaries,
          message: `${slugs.length} built-in skills available. Use action='read' with a slug.`,
        };
      }

      if (!slug) {
        return { success: false, error: "slug is required for read/read_rule" };
      }

      if (action === "read_rule") {
        if (!rule) {
          const rules = await listRuleFiles(slug);
          return {
            success: true,
            slug,
            availableRules: rules,
            message: rules.length
              ? `Call again with rule='<filename>' to load content.`
              : `No rules/ folder for skill '${slug}'.`,
          };
        }
        const rulePath = path.resolve(SKILLS_ROOT, slug, "rules", rule);
        if (
          !rulePath.startsWith(
            path.resolve(SKILLS_ROOT, slug, "rules") + path.sep
          )
        ) {
          return { success: false, error: "Invalid rule path" };
        }
        try {
          const content = await fs.readFile(rulePath, "utf-8");
          return { success: true, slug, rule, content };
        } catch {
          return {
            success: false,
            error: `Rule '${rule}' not found for skill '${slug}'`,
          };
        }
      }

      const content = await readSkillFile(slug);
      if (!content) {
        const available = await listSkillSlugs();
        return {
          success: false,
          error: `Skill '${slug}' not found.`,
          availableSkills: available,
        };
      }

      const rules = await listRuleFiles(slug);
      return {
        success: true,
        slug,
        content,
        availableRules: rules,
        size: content.length,
      };
    },
  });
