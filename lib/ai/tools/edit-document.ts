import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { getDocumentById, saveDocument } from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";

type EditDocumentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const editDocument = ({ session, dataStream }: EditDocumentProps) =>
  tool({
    description:
      "Make a targeted edit to an owned artifact by finding and replacing an exact string. Works with text, reports, planners, dashboards, sheets, PDFs, presentations, code, and images. Preferred over updateDocument for small changes. The old_string must match exactly.",
    inputSchema: z.object({
      id: z.string().describe("The ID of the artifact to edit"),
      old_string: z
        .string()
        .describe(
          "Exact string to find. Include 3-5 surrounding lines for uniqueness."
        ),
      new_string: z.string().describe("Replacement string"),
      replace_all: z
        .boolean()
        .optional()
        .describe(
          "Replace all occurrences instead of just the first (default false)"
        ),
    }),
    execute: async ({ id, old_string, new_string, replace_all }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return { error: "Document not found" };
      }

      if (document.userId !== session.user?.id) {
        return { error: "Forbidden" };
      }

      if (!document.content) {
        return { error: "Document has no content" };
      }

      if (!document.content.includes(old_string)) {
        return { error: "old_string not found in document" };
      }

      const updated = replace_all
        ? document.content.replaceAll(old_string, new_string)
        : document.content.replace(old_string, new_string);

      await saveDocument({
        id: document.id,
        title: document.title,
        kind: document.kind,
        content: updated,
        userId: document.userId,
      });

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      const deltaTypeByKind = {
        code: "data-codeDelta",
        dashboard: "data-dashboardDelta",
        image: "data-imageDelta",
        pdf: "data-pdfDelta",
        planner: "data-plannerDelta",
        presentation: "data-presentationDelta",
        report: "data-reportDelta",
        sheet: "data-sheetDelta",
        text: "data-textDelta",
      } as const;
      const deltaType =
        deltaTypeByKind[document.kind as keyof typeof deltaTypeByKind] ??
        "data-textDelta";

      dataStream.write({
        type: deltaType,
        data: updated,
        transient: true,
      });

      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content:
          document.kind === "code"
            ? "The script has been edited successfully."
            : "The document has been edited successfully.",
      };
    },
  });
