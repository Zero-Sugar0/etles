/**
 * lib/ai/tools/with-approval.ts
 *
 * Helper to flag a tool as requiring user approval before execution.
 *
 * The AI SDK supports a per-tool `needsApproval: true` flag. When set, the SDK
 * pauses before executing the tool and surfaces a confirmation card in the chat
 * UI (see message.tsx `Confirmation` + `ExpandableToolPill`), where the user
 * taps Allow/Deny via `addToolApprovalResponse`.
 *
 * This helper makes it trivial to enforce approval on any tool — including the
 * dynamically-loaded Composio tools — so irreversible actions (sending emails,
 * making payments, posting content, provisioning calls, etc.) can never bypass
 * the user.
 */

/**
 * Detect whether a Composio toolkit is irreversible and therefore must be
 * gated behind approval. Toolkit names are normalized lowercase.
 *
 * This is a conservative allow-list of "read/write" toolkits whose actions
 * touch the outside world. Read-only toolkits are intentionally excluded.
 */
const IRREVERSIBLE_TOOLKIT_HINTS = [
  "gmail",
  "outlook",
  "slack",
  "microsoftteams",
  "twitter",
  "twitteroauth",
  "facebook",
  "instagram",
  "linkedin",
  "telegram",
  "whatsapp",
  "discord",
  "stripe",
  "wise",
  "paypal",
  "chargebee",
  "recurly",
  "twilio",
  "calendly",
  "zoom",
  "googlemeet",
  "docusign",
  "hellosign",
  "jira",
  "linear",
  "github",
  "gitlab",
  "salesforce",
  "hubspot",
  "pipedrive",
  "intercom",
  "zendesk",
  "freshdesk",
  "front",
  "gong",
  "ses",
  "sendgrid",
  "mailgun",
  "hubspotcrm",
  "shopify",
  "woocommerce",
];

/**
 * Returns true if a Composio tool name (e.g. "GMAIL_SEND_EMAIL",
 * "STRIPE_CREATE_PAYMENT") maps to an irreversible toolkit.
 */
export function isIrreversibleTool(toolName: string): boolean {
  const upper = toolName.toUpperCase();
  return IRREVERSIBLE_TOOLKIT_HINTS.some((hint) => {
    const upperHint = hint.toUpperCase();
    return (
      upper.startsWith(`${upperHint}_`) ||
      upper.includes(`_${upperHint}_`) ||
      upper.endsWith(`_${upperHint}`)
    );
  });
}

/**
 * Wraps a set of tools (e.g. `composioTools`) so that any tool belonging to an
 * irreversible toolkit gets `needsApproval: true`. Non-matching tools pass
 * through unchanged.
 *
 * Usage:
 *   const composioTools = await session.tools();
 *   const tools = {
 *     ...withApproval(composioTools),
 *     getWeather,
 *     // ... other tools
 *   };
 */
export function withApproval(
  tools: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, toolDef] of Object.entries(tools)) {
    if (toolDef && typeof toolDef === "object" && isIrreversibleTool(name)) {
      result[name] = withNeedsApproval(toolDef);
    } else {
      result[name] = toolDef;
    }
  }
  return result;
}

/**
 * Marks a single tool (an AI SDK `tool()` object) as needing approval.
 * Works generically by spreading the original tool and setting the flag, so it
 * works with both the AI SDK tool objects and Composio's tool shapes.
 */
export function withNeedsApproval<T extends object>(
  toolDef: T
): T & {
  needsApproval: true;
} {
  return {
    ...toolDef,
    needsApproval: true,
  };
}
