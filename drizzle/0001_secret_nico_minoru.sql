-- Add, backfill, then constrain so an existing installation can migrate safely.
ALTER TABLE "briefing_articles" ADD COLUMN "source_snapshot" jsonb;
--> statement-breakpoint
UPDATE briefing_articles AS entry
SET source_snapshot = jsonb_build_object(
  'id', article.id,
  'sourceId', article.source_id,
  'sourceName', source.name,
  'title', article.title,
  'url', article.url,
  'content', article.content,
  'publishedAt', to_char(article.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
)
FROM articles AS article
JOIN sources AS source ON source.id = article.source_id
WHERE entry.article_id = article.id;
--> statement-breakpoint
ALTER TABLE "briefing_articles" ALTER COLUMN "source_snapshot" SET NOT NULL;
