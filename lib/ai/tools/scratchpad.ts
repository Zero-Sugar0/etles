import { tool } from "ai";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";

// Simple in-memory fallback cache
const memoryScratchpads = new Map<string, string>();

function getScratchpadPath(userId: string, keyId: string): string {
  // Use OS-dependent tmp directory (works on both Windows and Linux/Vercel)
  const tmpDir = process.env.TEMP || process.env.TMP || "/tmp";
  return path.join(tmpDir, `etles_scratchpad_${userId}_${keyId}.txt`);
}

function readScratch(userId: string, keyId: string): string {
  const cacheKey = `${userId}:${keyId}`;
  if (memoryScratchpads.has(cacheKey)) {
    return memoryScratchpads.get(cacheKey) || "";
  }
  const filePath = getScratchpadPath(userId, keyId);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      memoryScratchpads.set(cacheKey, content);
      return content;
    }
  } catch (err) {
    console.error("Failed to read scratchpad file:", err);
  }
  return "";
}

function writeScratch(userId: string, keyId: string, content: string) {
  const cacheKey = `${userId}:${keyId}`;
  memoryScratchpads.set(cacheKey, content);
  const filePath = getScratchpadPath(userId, keyId);
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, "utf-8");
  } catch (err) {
    console.error("Failed to write scratchpad file:", err);
  }
}

function clearScratch(userId: string, keyId: string) {
  const cacheKey = `${userId}:${keyId}`;
  memoryScratchpads.delete(cacheKey);
  const filePath = getScratchpadPath(userId, keyId);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("Failed to delete scratchpad file:", err);
  }
}

export const readScratchpad = ({
  userId,
  keyId,
}: {
  userId: string;
  keyId: string;
}) =>
  tool({
    description:
      "Read the contents of your scratchpad. Use this to retrieve your notes, plans, " +
      "or draft segments saved during execution.",
    inputSchema: z.object({}),
    execute: async () => {
      const content = readScratch(userId, keyId);
      return {
        success: true,
        content: content || "Scratchpad is empty.",
      };
    },
  });

export const writeScratchpad = ({
  userId,
  keyId,
}: {
  userId: string;
  keyId: string;
}) =>
  tool({
    description:
      "Write content to your scratchpad. You can either overwrite the scratchpad " +
      "or append to it. This is a private, persistent memory buffer for your thoughts, lists, plans, and code drafts.",
    inputSchema: z.object({
      content: z.string().describe("The content to write to the scratchpad."),
      mode: z
        .enum(["overwrite", "append"])
        .default("overwrite")
        .describe(
          "Whether to overwrite the entire scratchpad or append to the end of it."
        ),
    }),
    execute: async ({ content, mode }) => {
      let finalContent = content;
      if (mode === "append") {
        const current = readScratch(userId, keyId);
        finalContent = current ? `${current}\n${content}` : content;
      }
      writeScratch(userId, keyId, finalContent);
      return {
        success: true,
        message: `Successfully wrote to scratchpad in ${mode} mode.`,
        length: finalContent.length,
      };
    },
  });

export const clearScratchpad = ({
  userId,
  keyId,
}: {
  userId: string;
  keyId: string;
}) =>
  tool({
    description: "Clear all contents of your scratchpad.",
    inputSchema: z.object({}),
    execute: async () => {
      clearScratch(userId, keyId);
      return {
        success: true,
        message: "Scratchpad successfully cleared.",
      };
    },
  });
