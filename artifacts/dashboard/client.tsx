import { Artifact } from "@/components/create-artifact";
import { DashboardArtifact } from "@/components/dashboard-artifact";
export const dashboardArtifact = new Artifact({ kind: "dashboard", description: "Interactive KPI dashboard with filters, date ranges, charts, and tables.", content: ({ content }) => <DashboardArtifact content={content} />, actions: [], toolbar: [], onStreamPart: ({ setArtifact, streamPart }) => { if (streamPart.type === "data-dashboardDelta") setArtifact((artifact) => ({ ...artifact, content: artifact.content + streamPart.data })); } });
