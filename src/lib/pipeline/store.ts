import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { articles, sources, briefings, briefingArticles } from "@/lib/db/schema";
import { sourceDefinitions } from "@/lib/sources/collect";
import type { Checkpoint, PipelineStore } from "./types";
import { editionCopy, isPartial } from "./copy";

export function createStore(db = getDb()): PipelineStore {
  const owner = (date: string, runId: string) =>
    and(eq(briefings.date, date), eq(briefings.runId, runId), eq(briefings.status, "processing"));
  return {
    async claim(date, runId) {
      const result = await db.execute(sql`
        INSERT INTO briefings (date, status, run_id, lease_until)
        VALUES (${date}, 'processing', ${runId}::uuid, now() + interval '5 minutes')
        ON CONFLICT (date) DO UPDATE SET status = 'processing', run_id = ${runId}::uuid,
          lease_until = now() + interval '5 minutes', last_error = NULL
        WHERE briefings.status <> 'published' AND (briefings.lease_until IS NULL OR briefings.lease_until < now())
        RETURNING checkpoint`);
      if (result.rows.length)
        return { status: "acquired", checkpoint: result.rows[0].checkpoint as Checkpoint | null };
      const [existing] = await db
        .select({ status: briefings.status })
        .from(briefings)
        .where(eq(briefings.date, date));
      return { status: existing?.status === "published" ? "published" : "busy" };
    },
    async save(date, runId, checkpoint) {
      const result = await db
        .update(briefings)
        .set({ checkpoint, leaseUntil: sql`now() + interval '5 minutes'` })
        .where(owner(date, runId))
        .returning({ id: briefings.id });
      if (!result.length) throw new Error("Pipeline lease lost");
    },
    async publish(date, runId, checkpoint) {
      await db.transaction(async (tx) => {
        // Lock and fence the publisher. A stale invocation cannot publish after takeover.
        const [briefing] = await tx
          .select({ id: briefings.id })
          .from(briefings)
          .where(owner(date, runId))
          .for("update");
        if (!briefing) throw new Error("Pipeline lease lost");
        await tx
          .insert(sources)
          .values(sourceDefinitions.map((s) => ({ id: s.id, name: s.name, url: s.url })))
          .onConflictDoNothing();
        const selectedIds = new Set(checkpoint.stories.map((s) => s.id));
        const persisted = checkpoint.articles.filter((a) => selectedIds.has(a.id));
        const byId = new Map(persisted.map((a) => [a.id, a]));
        if (persisted.length !== checkpoint.stories.length)
          throw new Error("Missing source articles");
        await tx
          .insert(articles)
          .values(
            persisted.map((a) => ({
              id: a.id,
              sourceId: a.sourceId,
              title: a.title,
              url: a.url,
              content: a.content,
              publishedAt: new Date(a.publishedAt),
            })),
          )
          .onConflictDoNothing();
        await tx.insert(briefingArticles).values(
          checkpoint.stories.map((s, position) => ({
            briefingId: briefing.id,
            articleId: s.id,
            position,
            category: s.category,
            summary: s.summary,
            whyItMatters: s.whyItMatters,
            evidence: s.evidence,
            sourceSnapshot: byId.get(s.id)!,
            summaryKind: s.summaryKind ?? "ai",
          })),
        );
        await tx
          .update(briefings)
          .set({
            status: "published",
            ...editionCopy(checkpoint.stories),
            publishedAt: new Date(),
            repositories: checkpoint.repositories,
            themes: checkpoint.themes ?? [],
            reports: checkpoint.reports,
            outcomes: checkpoint.outcomes,
            partial: isPartial(checkpoint) ? 1 : 0,
            checkpoint: null,
            runId: null,
            leaseUntil: null,
          })
          .where(owner(date, runId));
      });
    },
    async release(date, runId, error) {
      await db
        .update(briefings)
        .set({
          runId: null,
          leaseUntil: null,
          ...(error ? { status: "failed" as const, lastError: error.slice(0, 300) } : {}),
        })
        .where(owner(date, runId));
    },
  };
}
