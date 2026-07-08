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

let globalToolkitsPromise: Promise<ToolkitInfo[]> | null = null;
let globalToolkitsCache: ToolkitInfo[] | null = null;

export function normalizeToolkitSlug(raw: string): string {
  const lower = raw.toLowerCase().replace(/-/g, "_");
  return TOOLKIT_SLUG_ALIASES[lower] ?? lower;
}

export function resolveToolkitSlug(appSlug: string): string {
  return normalizeToolkitSlug(appSlug);
}

export function findToolkit(
  toolkits: ToolkitInfo[],
  appSlug: string,
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
