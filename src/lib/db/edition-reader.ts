import { categorySchema } from "@/lib/schemas";
import { editionSchema } from "@/lib/schemas";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { briefings, briefingArticles } from "./schema";
import type { Edition, EditionIndexItem } from "@/lib/types";

export function createEditionReader(db = getDb()) {
  async function hydrate(row: typeof briefings.$inferSelect): Promise<Edition> {
    const rows = await db
      .select()
      .from(briefingArticles)
      .where(eq(briefingArticles.briefingId, row.id))
      .orderBy(briefingArticles.position);
    return editionSchema.parse({
      id: row.id,
      date: row.date,
      title: row.title,
      description: row.description,
      sample: false,
      partial: row.partial === 1,
      repositories: row.repositories,
      themes: row.themes,
      reports: row.reports,
      outcomes: row.outcomes,
      publishedAt: row.publishedAt?.toISOString(),
      stories: rows.map((entry) => ({
        id: entry.articleId,
        title: entry.sourceSnapshot.title,
        url: entry.sourceSnapshot.url,
        sourceName: entry.sourceSnapshot.sourceName,
        publishedAt: entry.sourceSnapshot.publishedAt,
        category: categorySchema.parse(entry.category),
        summary: entry.summary,
        whyItMatters: entry.whyItMatters,
        evidence: entry.evidence,
        summaryKind: entry.summaryKind,
      })),
    });
  }
  async function latest(): Promise<Edition | null> {
    const [row] = await db
      .select()
      .from(briefings)
      .where(eq(briefings.status, "published"))
      .orderBy(desc(briefings.date))
      .limit(1);
    return row ? hydrate(row) : null;
  }
  async function byDate(date: string): Promise<Edition | null> {
    const [row] = await db
      .select()
      .from(briefings)
      .where(and(eq(briefings.date, date), eq(briefings.status, "published")))
      .limit(1);
    return row ? hydrate(row) : null;
  }
  async function list() {
    const rows = await db
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
    return rows.map((row): EditionIndexItem => {
      if (row.title === null || row.description === null)
        throw new Error("Published edition metadata is incomplete");
      return {
        id: row.id,
        date: row.date,
        title: row.title,
        description: row.description,
        sample: false,
        count: row.outcomes?.summaries ?? 0,
      };
    });
  }

  return { latest, byDate, list };
}
