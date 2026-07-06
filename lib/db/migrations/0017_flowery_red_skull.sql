CREATE TABLE IF NOT EXISTS "CampaignQueue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missionId" uuid NOT NULL,
	"channel" varchar NOT NULL,
	"recipient" text NOT NULL,
	"content" text NOT NULL,
	"scheduledFor" timestamp NOT NULL,
	"status" varchar DEFAULT 'pending_review' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Mission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"chatId" uuid,
	"goal" text NOT NULL,
	"startupDescription" text,
	"productUrl" varchar(255),
	"status" varchar DEFAULT 'pending' NOT NULL,
	"durationDays" integer DEFAULT 14 NOT NULL,
	"currentDay" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "CampaignQueue" ADD CONSTRAINT "CampaignQueue_missionId_Mission_id_fk" FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Mission" ADD CONSTRAINT "Mission_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Mission" ADD CONSTRAINT "Mission_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
