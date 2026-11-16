import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { briefings, briefingArticles } from "./db/schema";
import { sampleEdition } from "./sample";
import type { Edition, Category } from "./types";

async function hydrate(row: typeof briefings.$inferSelect): Promise<Edition> {
  const rows = await getDb()
    .select()
    .from(briefingArticles)
    .where(eq(briefingArticles.briefingId, row.id))
    .orderBy(briefingArticles.position);
  return {
    id: row.id,
    date: row.date,
    title: row.title!,
    description: row.description!,
    sample: false,
    partial: row.partial === 1,
    repositories: row.repositories,
    themes: row.themes,
    reports: row.reports,
    outcomes: row.outcomes!,
    publishedAt: row.publishedAt!.toISOString(),
    stories: rows.map((entry) => ({
      id: entry.articleId,
      title: entry.sourceSnapshot.title,
      url: entry.sourceSnapshot.url,
      sourceName: entry.sourceSnapshot.sourceName,
      publishedAt: entry.sourceSnapshot.publishedAt,
      category: entry.category as Category,
      summary: entry.summary,
      whyItMatters: entry.whyItMatters,
      evidence: entry.evidence,
      summaryKind: entry.summaryKind,
    })),
  };
}
export const getLatestEdition = cache(async (): Promise<Edition | null> => {
  if (!process.env.DATABASE_URL) return sampleEdition;
  const [row] = await getDb()
    .select()
    .from(briefings)
    .where(eq(briefings.status, "published"))
    .orderBy(desc(briefings.date))
    .limit(1);
  return row ? hydrate(row) : null;
});
export const getEdition = cache(async (date: string): Promise<Edition | null> => {
  if (!process.env.DATABASE_URL) return date === sampleEdition.date ? sampleEdition : null;
  const [row] = await getDb()
    .select()
    .from(briefings)
    .where(and(eq(briefings.date, date), eq(briefings.status, "published")))
    .limit(1);
  return row ? hydrate(row) : null;
});
export const listEditions = cache(async () => {
  if (!process.env.DATABASE_URL)
    return [
      {
        id: sampleEdition.id,
        date: sampleEdition.date,
        title: sampleEdition.title,
        description: sampleEdition.description,
        sample: true,
        sampleKind: sampleEdition.sampleKind,
        count: sampleEdition.stories.length,
      },
    ];
  const rows = await getDb()
    .select({
      id: briefings.id,
      date: briefings.date,
      title: briefings.title,
      description: briefings.description,
      outcomes: briefings.outcomes,
    })
    .from(briefings)
    .where(eq(briefings.status, "published"))
    .orderBy(desc(briefings.date))
    .limit(366);
  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    title: row.title!,
    description: row.description!,
    sample: false,
    count: row.outcomes?.summaries ?? 0,
  }));
});
