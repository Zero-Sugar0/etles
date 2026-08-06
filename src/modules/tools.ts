export interface ToolSchema {
  description: string;
  exampleInput: Record<string, any>;
  icon: string;
  name: string;
  schema: Record<string, any>;
}

export const AVAILABLE_TOOLS: ToolSchema[] = [
  {
    name: "memory_set",
    icon: "💾",
    description:
      "Save or update a specific key-value pair in long-term semantic memory.",
    schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "The identifier for the memory" },
        value: { type: "string", description: "The value to save" },
        type: {
          type: "string",
          enum: ["string", "json", "list"],
          default: "string",
        },
      },
      required: ["key", "value"],
    },
    exampleInput: {
      key: "user_preferred_timezone",
      value: "EST",
      type: "string",
    },
  },
  {
    name: "shell_execute",
    icon: "🐚",
    description:
      "Execute a terminal command or launch long-running shell processes inside the sandbox environment.",
    schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to run" },
        timeout: {
          type: "number",
          description: "Max runtime in ms",
          default: 30_000,
        },
      },
      required: ["command"],
    },
    exampleInput: { command: "npm run test", timeout: 15_000 },
  },
  {
    name: "file_edit",
    icon: "📝",
    description:
      "Apply diffs or modify files within the project tree securely using search-and-replace blocks.",
    schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to target file" },
        diff: {
          type: "string",
          description: "Diff patch using standard merge blocks or Unified Diff",
        },
      },
      required: ["path", "diff"],
    },
    exampleInput: {
      path: "src/config.ts",
      diff: "<<<<<<< SEARCH\nconst PORT = 3000;\n=======\nconst PORT = 8080;\n>>>>>>> REPLACE",
    },
  },
  {
    name: "browser_search",
    icon: "🌐",
    description:
      "Research topics or queries live using Tavily or crawl webpages using Firecrawl.",
    schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term or query" },
        maxResults: { type: "number", default: 5 },
      },
      required: ["query"],
    },
    exampleInput: {
      query: "latest Claude Code TUI release notes",
      maxResults: 3,
    },
  },
  {
    name: "send_whatsapp",
    icon: "💬",
    description:
      "Send proactive alerts, reports, or messages using Twilio WhatsApp API.",
    schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient phone number" },
        message: {
          type: "string",
          description: "Text body or template to send",
        },
      },
      required: ["to", "message"],
    },
    exampleInput: {
      to: "+1234567890",
      message: "Alert: Cloud spending is nearing 80% budget limit!",
    },
  },
];

export function listTools(): ToolSchema[] {
  return AVAILABLE_TOOLS;
}

export function inspectTool(name: string): ToolSchema | null {
  return AVAILABLE_TOOLS.find((t) => t.name === name) || null;
}
