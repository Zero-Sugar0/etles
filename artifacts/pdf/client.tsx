import { Artifact } from "@/components/create-artifact";
import { RedoIcon, UndoIcon } from "@/components/icons";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { PdfArtifact } from "@/components/pdf-artifact";
import {
  downloadPdfFromMarkdown,
  pdfThemeLabels,
  pdfThemes,
  stripPdfThemeComment,
  type PdfTheme,
} from "@/components/pdf-export";
import {
  Download,
  Palette,
  Pencil,
  Printer,
  Sparkles,
  Type,
} from "lucide-react";

const PDF_THEME_STORAGE_KEY = "etles:pdf-theme";

type PdfArtifactMetadata = {
  theme?: PdfTheme;
  editMode?: boolean;
};

export const pdfArtifact = new Artifact<"pdf", PdfArtifactMetadata>({
  kind: "pdf",
  description:
    "Print-ready PDF document with proposal, invoice, contract, and brief layouts.",
  initialize: ({ setMetadata }) => {
    // Only pin a theme when the user previously picked one; fresh documents
    // keep honoring the model-authored <!-- pdf-theme --> comment.
    let savedTheme: PdfTheme | undefined;
    try {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(PDF_THEME_STORAGE_KEY);
        if (stored && (pdfThemes as readonly string[]).includes(stored)) {
          savedTheme = stored as PdfTheme;
        }
      }
    } catch {
      savedTheme = undefined;
    }
    setMetadata(
      savedTheme ? { theme: savedTheme, editMode: false } : { editMode: false }
    );
  },
  content: ({
    content,
    isLoading,
    title,
    onSaveContent,
    suggestions,
    metadata,
  }) =>
    isLoading ? (
      <DocumentSkeleton artifactKind="pdf" />
    ) : (
      <PdfArtifact
        content={content}
        editMode={Boolean(metadata?.editMode)}
        onSaveContent={onSaveContent}
        title={title}
        suggestions={suggestions}
        theme={metadata?.theme}
      />
    ),
  actions: [
    {
      icon: <Palette size={16} />,
      description: "Switch document theme",
      label: "Theme",
      onClick: () => undefined,
      isActive: ({ metadata }) => Boolean(metadata?.theme),
      menuItems: pdfThemes.map((theme) => ({
        label: pdfThemeLabels[theme],
        onClick: ({ metadata, setMetadata }) => {
          setMetadata({ ...(metadata ?? {}), theme });
          try {
            window.localStorage.setItem(PDF_THEME_STORAGE_KEY, theme);
          } catch {
            // Storage can be unavailable (private mode); the choice still applies in-memory.
          }
        },
      })),
    },
    {
      icon: <Pencil size={16} />,
      description: "Edit PDF content",
      onClick: ({ metadata, setMetadata }) =>
        setMetadata({ ...(metadata ?? {}), editMode: true }),
    },
    {
      icon: <Download size={16} />,
      description: "Download PDF",
      onClick: ({ content, title, metadata }) => {
        const theme = metadata?.theme;
        // When the user picked a theme, export with the same override the
        // preview uses so the downloaded file matches what is on screen.
        const markdown = theme ? stripPdfThemeComment(content) : content;
        return downloadPdfFromMarkdown(markdown, title, theme ?? "slate");
      },
    },
    {
      icon: <Printer size={16} />,
      description: "Print PDF",
      onClick: () => window.print(),
    },
    {
      icon: <UndoIcon size={18} />,
      description: "View previous version",
      onClick: ({ handleVersionChange }) => handleVersionChange("prev"),
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View next version",
      onClick: ({ handleVersionChange }) => handleVersionChange("next"),
      isDisabled: ({ isCurrentVersion }) => isCurrentVersion,
    },
  ],
  toolbar: [
    {
      icon: <Sparkles size={16} />,
      description: "Polish for print",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Polish this PDF document for print: tighten wording, use bold lead-ins and blockquote callouts, keep tables narrow enough to wrap cleanly on Letter pages, and keep exactly one pdf-theme comment at the top.",
            },
          ],
        });
      },
    },
    {
      icon: <Type size={16} />,
      description: "Balance sections across pages",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Reorganize this PDF document so sections are balanced across pages: a clear cover/title block, evenly weighted section headings, and no orphaned tables or charts.",
            },
          ],
        });
      },
    },
  ],
  onStreamPart: ({ setArtifact, streamPart }) => {
    if (streamPart.type === "data-pdfDelta") {
      setArtifact((artifact) => ({
        ...artifact,
        content: artifact.content + streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
});
