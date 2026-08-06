/**
 * Shared Composio toolkit logo cache and slug resolution.
 * Used by ToolPill (chat UI) and preloaded on chat mount.
 */

export type ToolkitInfo = {
  slug: string;
  name: string;
  logo?: string;
  requiresAuth?: boolean;
  isConnected?: boolean;
};

const KNOWN_COMPOSIO_TOOLKIT_SLUGS = [
  "activecampaign",
  "airtable",
  "apollo",
  "asana",
  "box",
  "calendly",
  "clickup",
  "cloudflare",
  "confluence",
  "discord",
  "docusign",
  "dropbox",
  "facebook",
  "figma",
  "github",
  "gitlab",
  "gmail",
  "googlecalendar",
  "googlechat",
  "googledocs",
  "googledrive",
  "googleforms",
  "googlemeet",
  "googlesheets",
  "hubspot",
  "instagram",
  "intercom",
  "jira",
  "klaviyo",
  "linear",
  "linkedin",
  "mailchimp",
  "microsoftteams",
  "monday",
  "notion",
  "onedrive",
  "outlook",
  "paypal",
  "pipedrive",
  "posthog",
  "quickbooks",
  "reddit",
  "salesforce",
  "sendgrid",
  "sentry",
  "shopify",
  "slack",
  "stripe",
  "telegram",
  "todoist",
  "trello",
  "twilio",
  "typeform",
  "webflow",
  "whatsapp",
  "woocommerce",
  "xero",
  "youtube",
  "zapier",
  "zendesk",
  "zoom",
];

/** Map tool-name prefixes / aliases → Composio toolkit slug */
export const TOOLKIT_SLUG_ALIASES: Record<string, string> = {
  googlecalendar: "googlecalendar",
  google_calendar: "googlecalendar",
  googlecal: "googlecalendar",
  googledrive: "googledrive",
  google_drive: "googledrive",
  googledocs: "googledocs",
  google_docs: "googledocs",
  googlesheets: "googlesheets",
  google_sheets: "googlesheets",
  googlemeet: "googlemeet",
  google_meet: "googlemeet",
  microsoftteams: "microsoftteams",
  microsoft_teams: "microsoftteams",
  msteams: "microsoftteams",
  gchat: "googlechat",
  googlechat: "googlechat",
  google_chat: "googlechat",
  gh: "github",
  twiliowhatsapp: "whatsapp",
  twilio_whatsapp: "whatsapp",
};

const LOCAL_LOGO_SLUG_ALIASES: Record<string, string> = {
  googlecalendar: "google-calendar",
  googlechat: "google",
  googledocs: "google-docs",
  googledrive: "google-drive",
  googleforms: "google-forms",
  googlemeet: "google-meet",
  googlesheets: "google-sheets",
  microsoftteams: "teams",
};

let globalToolkitsPromise: Promise<ToolkitInfo[]> | null = null;
let globalToolkitsCache: ToolkitInfo[] | null = null;

export function normalizeToolkitSlug(raw: string): string {
  const lower = raw.toLowerCase().replace(/-/g, "_");
  return TOOLKIT_SLUG_ALIASES[lower] ?? lower;
}

export function resolveToolkitSlug(appSlug: string): string {
  return normalizeToolkitSlug(appSlug);
}

export function resolveToolkitLogoSlug(appSlug: string): string {
  const resolved = resolveToolkitSlug(appSlug);
  return LOCAL_LOGO_SLUG_ALIASES[resolved] ?? resolved;
}

export function resolveToolkitLogoSrc(appSlug: string): string {
  return `/logos/${resolveToolkitLogoSlug(appSlug)}.svg`;
}

function isKnownToolkitSlug(candidate: string): boolean {
  return KNOWN_COMPOSIO_TOOLKIT_SLUGS.includes(normalizeToolkitSlug(candidate));
}

export function splitComposioToolName(type: string): {
  actionName: string;
  appSlug: string;
} | null {
  const raw = type.replace(/^tool-/, "");
  const withoutComposio = raw.replace(/^composio[_-]/i, "");
  const parts = withoutComposio.split(/[_-]+/).filter(Boolean);

  for (let i = Math.min(parts.length - 1, 4); i >= 1; i--) {
    const candidate = parts.slice(0, i).join("_").toLowerCase();
    if (isKnownToolkitSlug(candidate)) {
      return {
        appSlug: resolveToolkitSlug(candidate),
        actionName: parts.slice(i).join("_").toLowerCase() || "execute",
      };
    }
  }

  return null;
}

export function findToolkit(
  toolkits: ToolkitInfo[],
  appSlug: string
): ToolkitInfo | undefined {
  const normalized = resolveToolkitSlug(appSlug);
  return toolkits.find((t) => {
    const slug = t.slug.toLowerCase();
    const name = t.name.toLowerCase().replace(/\s+/g, "");
    return (
      slug === normalized ||
      slug === appSlug.toLowerCase() ||
      name === appSlug.toLowerCase() ||
      name === normalized.replace(/_/g, "") ||
      slug.replace(/_/g, "") === normalized.replace(/_/g, "")
    );
  });
}

export function preloadToolkitLogos(): Promise<ToolkitInfo[]> {
  if (globalToolkitsCache) {
    return Promise.resolve(globalToolkitsCache);
  }
  if (globalToolkitsPromise) {
    return globalToolkitsPromise;
  }

  globalToolkitsPromise = fetch("/api/connections")
    .then((res) => {
      if (!res.ok) {
        return { toolkits: [] as ToolkitInfo[] };
      }
      return res.json() as Promise<{ toolkits?: ToolkitInfo[] }>;
    })
    .then((data) => {
      globalToolkitsCache = data.toolkits ?? [];
      return globalToolkitsCache;
    })
    .catch(() => {
      globalToolkitsCache = [];
      return globalToolkitsCache;
    });

  return globalToolkitsPromise;
}

export function getCachedToolkits(): ToolkitInfo[] | null {
  return globalToolkitsCache;
}

/** Turn GMAIL_SEND_EMAIL / send_email into friendly "send email" */
export function formatActionDescriptor(actionName: string): string {
  const cleaned = actionName
    .replace(/^composio_+/i, "")
    .replace(/^_+/, "")
    .toLowerCase();
  return cleaned.replace(/_/g, " ").trim() || "execute";
}
