CREATE TABLE IF NOT EXISTS "UserCredential" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"provider" varchar(64) NOT NULL,
	"keyName" varchar(128) NOT NULL,
	"encryptedValue" text NOT NULL,
	"valueHint" varchar(32) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UserCredential_user_provider_key_unique" UNIQUE("userId","provider","keyName")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserCredential" ADD CONSTRAINT "UserCredential_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
