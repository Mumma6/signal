import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { briefings, briefingArticles } from "@/lib/db/schema";
import { publishBriefing } from "./publication";
import type { Checkpoint } from "@/lib/pipeline/types";

// Owner-only CLI maintenance. Never exposed through an HTTP route or cron.
// The caller must save a backup and review the replacement before applying it.
export async function reviseToday(
  date: string,
  expectedPublishedAt: Date,
  draft: Checkpoint,
  db = getDb(),
) {
  if (date !== new Date().toISOString().slice(0, 10))
    throw new Error("Only today's UTC edition may be revised");
  if (draft.phase !== "publish" || !draft.stories.length)
    throw new Error("A complete nonempty draft is required");
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(briefings)
      .where(and(eq(briefings.date, date), eq(briefings.status, "published")))
      .for("update");
    if (!row || row.publishedAt?.getTime() !== expectedPublishedAt.getTime())
      throw new Error("Edition changed after review; revision canceled");
    const runId = randomUUID();
    await tx.update(briefings).set({ status: "processing", runId }).where(eq(briefings.id, row.id));
    await tx.delete(briefingArticles).where(eq(briefingArticles.briefingId, row.id));
    // Reuse publication inside this transaction; no nested store or driver cast.
    await publishBriefing(tx, date, runId, draft);
  });
}
