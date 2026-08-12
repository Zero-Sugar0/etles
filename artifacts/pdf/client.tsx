import { Artifact } from "@/components/create-artifact";
import { PdfArtifact } from "@/components/pdf-artifact";
export const pdfArtifact = new Artifact({ kind: "pdf", description: "Print-ready PDF document with proposal, invoice, contract, and brief layouts.", content: ({ content }) => <PdfArtifact content={content} />, actions: [], toolbar: [], onStreamPart: ({ setArtifact, streamPart }) => { if (streamPart.type === "data-pdfDelta") setArtifact((artifact) => ({ ...artifact, content: artifact.content + streamPart.data })); } });
