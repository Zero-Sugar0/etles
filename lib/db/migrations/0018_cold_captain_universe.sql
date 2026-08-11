CREATE TABLE IF NOT EXISTS "AgentSchedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"agentSlug" varchar(128) NOT NULL,
	"department" varchar(128),
	"title" text NOT NULL,
	"message" text NOT NULL,
	"kind" varchar NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"cron" varchar(128),
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"startsAt" timestamp,
	"nextRunAt" timestamp,
	"lastRunAt" timestamp,
	"qstashId" varchar(255),
	"idempotencyKey" varchar(255) NOT NULL,
	"payload" json DEFAULT '{}'::json NOT NULL,
	"retryCount" integer DEFAULT 0 NOT NULL,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "AgentScheduleEvent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduleId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"eventKey" varchar(255) NOT NULL,
	"type" varchar(32) NOT NULL,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserMedia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"url" text NOT NULL,
	"name" text NOT NULL,
	"mimeType" varchar(64) DEFAULT 'image/png' NOT NULL,
	"source" varchar DEFAULT 'upload' NOT NULL,
	"prompt" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AgentSchedule" ADD CONSTRAINT "AgentSchedule_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AgentScheduleEvent" ADD CONSTRAINT "AgentScheduleEvent_scheduleId_AgentSchedule_id_fk" FOREIGN KEY ("scheduleId") REFERENCES "public"."AgentSchedule"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AgentScheduleEvent" ADD CONSTRAINT "AgentScheduleEvent_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserMedia" ADD CONSTRAINT "UserMedia_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
