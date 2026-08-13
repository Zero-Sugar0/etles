import { Artifact } from "@/components/create-artifact";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { PdfArtifact } from "@/components/pdf-artifact";

export const pdfArtifact = new Artifact({
  kind: "pdf",
  description:
    "Print-ready PDF document with proposal, invoice, contract, and brief layouts.",
  content: ({ content, isLoading, title }) =>
    isLoading ? (
      <DocumentSkeleton artifactKind="pdf" />
    ) : (
      <PdfArtifact content={content} title={title} />
    ),
  actions: [],
  toolbar: [],
  onStreamPart: ({ setArtifact, streamPart }) => {
    if (streamPart.type === "data-pdfDelta") {
      setArtifact((artifact) => ({
        ...artifact,
        content: artifact.content + streamPart.data,
        status: "streaming",
      }));
    }
  },
});
