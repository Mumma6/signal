import "server-only";
import { and, eq, lt, gte, sql } from "drizzle-orm";
import { checkpointSchema } from "@/lib/pipeline/checkpoint";
import { getDb } from "@/lib/db";
import { briefings, briefingArticles } from "@/lib/db/schema";
import type { PipelineStore } from "@/lib/pipeline/types";
import { leaseOwner, publishBriefing } from "./publication";

export function createStore(db = getDb()): PipelineStore {
  return {
    async recentArticles(date) {
      return db
        .select({
          id: briefingArticles.articleId,
          title: sql<string>`${briefingArticles.sourceSnapshot}->>'title'`,
          url: sql<string>`${briefingArticles.sourceSnapshot}->>'url'`,
          sourceId: sql<string>`${briefingArticles.sourceSnapshot}->>'sourceId'`,
        })
        .from(briefingArticles)
        .innerJoin(briefings, eq(briefingArticles.briefingId, briefings.id))
        .where(
          and(
            eq(briefings.status, "published"),
            lt(briefings.date, date),
            gte(briefings.date, sql`${date}::date - 30`),
          ),
        );
    },
    async claim(date, runId) {
      const result = await db.execute(sql`
        INSERT INTO briefings (date, status, run_id, lease_until)
        VALUES (${date}, 'processing', ${runId}::uuid, now() + interval '5 minutes')
        ON CONFLICT (date) DO UPDATE SET status = 'processing', run_id = ${runId}::uuid,
          lease_until = now() + interval '5 minutes', last_error = NULL
        WHERE briefings.status <> 'published' AND (briefings.lease_until IS NULL OR briefings.lease_until < now())
        RETURNING checkpoint`);
      if (result.rows.length) {
        try {
          return {
            status: "acquired",
            checkpoint:
              result.rows[0].checkpoint == null
                ? null
                : checkpointSchema.parse(result.rows[0].checkpoint),
          };
        } catch (error) {
          await db
            .update(briefings)
            .set({
              status: "failed",
              runId: null,
              leaseUntil: null,
              lastError: "Invalid saved checkpoint; editorial recovery is required.",
            })
            .where(leaseOwner(date, runId));
          throw new Error("Saved briefing checkpoint is invalid", { cause: error });
        }
      }
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
        .where(leaseOwner(date, runId))
        .returning({ id: briefings.id });
      if (!result.length) throw new Error("Pipeline lease lost");
    },
    async publish(date, runId, checkpoint) {
      await db.transaction(async (tx) => {
        await publishBriefing(tx, date, runId, checkpoint);
      });
    },
    async release(date, runId, error, discardCheckpoint = false) {
      await db
        .update(briefings)
        .set({
          runId: null,
          leaseUntil: null,
          ...(discardCheckpoint ? { checkpoint: null } : {}),
          ...(error ? { status: "failed" as const, lastError: error.slice(0, 300) } : {}),
        })
        .where(leaseOwner(date, runId));
    },
  };
}
