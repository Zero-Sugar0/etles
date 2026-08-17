ALTER TABLE "CampaignQueue" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "CampaignQueue" ADD COLUMN "lastError" text;--> statement-breakpoint
ALTER TABLE "CampaignQueue" ADD COLUMN "claimedAt" timestamp;--> statement-breakpoint
ALTER TABLE "CampaignQueue" ADD COLUMN "sentAt" timestamp;--> statement-breakpoint
ALTER TABLE "CampaignQueue" ADD COLUMN "failedAt" timestamp;--> statement-breakpoint
ALTER TABLE "CampaignQueue" ADD COLUMN "providerMessageId" text;--> statement-breakpoint
ALTER TABLE "CampaignQueue" ADD COLUMN "qstashMessageId" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "BotIntegration_user_platform_unique" ON "BotIntegration" USING btree ("userId","platform");
