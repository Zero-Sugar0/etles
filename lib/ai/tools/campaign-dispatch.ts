import "server-only";

import { getComposioClient } from "@/lib/composio-client";

type Channel = "email" | "linkedin" | "reddit";

type ToolInfo = {
  name?: string;
  slug?: string;
  version?: string;
  input_parameters?: { properties?: Record<string, unknown> };
  inputParameters?: { properties?: Record<string, unknown> };
};

function propertiesFor(tool: ToolInfo): string[] {
  const schema = tool.input_parameters ?? tool.inputParameters;
  return Object.keys(schema?.properties ?? {});
}

function setFirst(
  args: Record<string, unknown>,
  properties: string[],
  names: string[],
  value: string
) {
  const key = properties.find((property) => names.includes(property.toLowerCase()));
  if (key) args[key] = value;
  return Boolean(key);
}

function buildArguments(channel: Channel, tool: ToolInfo, recipient: string, content: string) {
  const properties = propertiesFor(tool);
  const args: Record<string, unknown> = {};

  if (channel === "email") {
    if (!setFirst(args, properties, ["recipient_email", "to", "recipient", "email"], recipient)) {
      throw new Error("The connected email provider does not expose a recipient field.");
    }
    if (!setFirst(args, properties, ["subject", "email_subject"], "Campaign outreach")) {
      throw new Error("The connected email provider does not expose a subject field.");
    }
    if (!setFirst(args, properties, ["body", "body_text", "content", "message", "text"], content)) {
      throw new Error("The connected email provider does not expose a message field.");
    }
    return args;
  }

  if (!setFirst(args, properties, ["text", "content", "body", "message", "post_content"], content)) {
    throw new Error(`The ${channel} provider does not expose a post content field.`);
  }

  if (channel === "reddit") {
    setFirst(args, properties, ["subreddit", "community", "forum"], recipient);
    setFirst(args, properties, ["title", "subject"], "Campaign update");
  }

  return args;
}

function isCandidate(channel: Channel, name: string) {
  const upper = name.toUpperCase();
  if (channel === "email") return upper.includes("SEND") && upper.includes("EMAIL");
  if (channel === "linkedin") return upper.includes("POST") || upper.includes("PUBLISH");
  return upper.includes("POST") || upper.includes("SUBMIT");
}

export async function dispatchCampaignContent({
  channel,
  recipient,
  content,
  userId,
}: {
  channel: Channel;
  recipient: string;
  content: string;
  userId: string;
}) {
  const toolkit = channel === "email" ? "gmail" : channel;
  const composio = await getComposioClient(userId);
  const available = (await (composio.tools as any).get(userId, {
    toolkits: [toolkit],
    limit: 100,
  })) as ToolInfo[];
  const tools = Array.isArray(available) ? available : ((available as any)?.items ?? []);
  const selected = tools.find((tool: ToolInfo) =>
    isCandidate(channel, tool.name ?? tool.slug ?? "")
  );

  if (!selected) {
    throw new Error(`No supported ${channel} publishing tool is available for this connection.`);
  }

  const toolName = selected.name ?? selected.slug;
  if (!toolName) throw new Error(`The ${channel} publishing tool has no executable name.`);
  const version = selected.version;
  if (!version) throw new Error(`The ${channel} publishing tool has no pinned version.`);

  const result = await (composio.tools as any).execute(toolName, {
    userId,
    arguments: buildArguments(channel, selected, recipient, content),
    version,
  });

  const resultRecord = result as Record<string, unknown>;
  const data = (resultRecord.data ?? resultRecord) as Record<string, unknown>;
  const providerMessageId =
    typeof data.id === "string"
      ? data.id
      : typeof data.message_id === "string"
        ? data.message_id
        : undefined;

  return { providerMessageId };
}
