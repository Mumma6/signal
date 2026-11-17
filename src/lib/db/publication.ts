import "server-only";
import { and, eq } from "drizzle-orm";
import { articles, sources, briefings, briefingArticles } from "./schema";
import { sourceDefinitions } from "@/lib/sources/registry";
import type { DatabaseSession } from "./index";
import type { Checkpoint } from "@/lib/pipeline/types";
import { editionCopy, isPartial } from "@/lib/editorial/copy";
export const leaseOwner = (date: string, runId: string) =>
  and(eq(briefings.date, date), eq(briefings.runId, runId), eq(briefings.status, "processing"));
export async function publishBriefing(
  tx: DatabaseSession,
  date: string,
  runId: string,
  checkpoint: Checkpoint,
) {
  // Lock and fence the publisher. A stale invocation cannot publish after takeover.
  const [briefing] = await tx
    .select({ id: briefings.id })
    .from(briefings)
    .where(leaseOwner(date, runId))
    .for("update");
  if (!briefing) throw new Error("Pipeline lease lost");
  await tx
    .insert(sources)
    .values(sourceDefinitions.map((s) => ({ id: s.id, name: s.name, url: s.url })))
    .onConflictDoNothing();
  const selectedIds = new Set(checkpoint.stories.map((s) => s.id));
  const persisted = checkpoint.articles.filter((a) => selectedIds.has(a.id));
  const byId = new Map(persisted.map((a) => [a.id, a]));
  if (persisted.length !== checkpoint.stories.length) throw new Error("Missing source articles");
  const sourceFor = (id: string) => {
    const source = byId.get(id);
    if (!source) throw new Error("Missing source article for published story");
    return source;
  };
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
      sourceSnapshot: sourceFor(s.id),
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
    .where(leaseOwner(date, runId));
}
