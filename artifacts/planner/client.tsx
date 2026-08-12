import { Artifact } from "@/components/create-artifact";
import { PlannerArtifact } from "@/components/planner-artifact";
export const plannerArtifact = new Artifact({ kind: "planner", description: "Editable calendar and planner with deadlines, reminders, tasks, and timelines.", content: ({ content }) => <PlannerArtifact content={content} />, actions: [], toolbar: [], onStreamPart: ({ setArtifact, streamPart }) => { if (streamPart.type === "data-plannerDelta") setArtifact((artifact) => ({ ...artifact, content: artifact.content + streamPart.data })); } });
