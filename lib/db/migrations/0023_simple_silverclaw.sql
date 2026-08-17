ALTER TABLE "AgentTask" ADD COLUMN "workspaceId" uuid;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "workspaceId" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
