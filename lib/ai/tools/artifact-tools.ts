import type { Session } from "next-auth";
import { z } from "zod";
import { createDocument } from "./create-document";

type Props = Parameters<typeof createDocument>[0];
const fixed =
  (kind: "presentation" | "pdf" | "dashboard" | "planner", label: string) =>
  ({ session, dataStream, modelId }: Props) => {
    const base = createDocument({ session, dataStream, modelId });
    return {
      ...base,
      description: `Create a dedicated ${label} artifact. Use this instead of a generic document when the user asks for a ${label}.`,
      inputSchema: z.object({
        title: z.string().min(1),
        kind: z.literal(kind).default(kind),
      }),
    };
  };
export const createPresentation = fixed("presentation", "presentation deck");
export const createPdf = fixed("pdf", "PDF document");
export const createDashboard = fixed("dashboard", "business dashboard");
export const createPlanner = fixed("planner", "calendar planner");
export type ArtifactToolSession = Session;
