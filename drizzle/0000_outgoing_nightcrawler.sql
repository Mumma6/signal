CREATE TABLE "articles" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"content" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "briefing_articles" (
	"briefing_id" uuid NOT NULL,
	"article_id" text NOT NULL,
	"position" integer NOT NULL,
	"category" text NOT NULL,
	"summary" text NOT NULL,
	"why_it_matters" text NOT NULL,
	"evidence" jsonb NOT NULL,
	CONSTRAINT "briefing_position_check" CHECK ("briefing_articles"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"run_id" uuid,
	"lease_until" timestamp with time zone,
	"checkpoint" jsonb,
	"title" text,
	"description" text,
	"repositories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reports" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outcomes" jsonb,
	"partial" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "briefings_date_unique" UNIQUE("date"),
	CONSTRAINT "briefings_status_check" CHECK ("briefings"."status" in ('processing', 'published', 'failed')),
	CONSTRAINT "briefings_publication_check" CHECK ("briefings"."status" <> 'published' or ("briefings"."published_at" is not null and "briefings"."title" is not null)),
	CONSTRAINT "briefings_partial_check" CHECK ("briefings"."partial" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefing_articles" ADD CONSTRAINT "briefing_articles_briefing_id_briefings_id_fk" FOREIGN KEY ("briefing_id") REFERENCES "public"."briefings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefing_articles" ADD CONSTRAINT "briefing_articles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_url_unique" ON "articles" USING btree ("url");--> statement-breakpoint
CREATE INDEX "articles_published_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "briefing_article_unique" ON "briefing_articles" USING btree ("briefing_id","article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "briefing_position_unique" ON "briefing_articles" USING btree ("briefing_id","position");--> statement-breakpoint
CREATE INDEX "briefings_status_date_idx" ON "briefings" USING btree ("status","date");