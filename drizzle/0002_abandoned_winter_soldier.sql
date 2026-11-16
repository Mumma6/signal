ALTER TABLE "briefing_articles" ADD COLUMN "summary_kind" text DEFAULT 'ai' NOT NULL;--> statement-breakpoint
ALTER TABLE "briefings" ADD COLUMN "themes" jsonb DEFAULT '[]'::jsonb NOT NULL;