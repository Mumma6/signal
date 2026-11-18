import "server-only";
import { validDate } from "@/lib/dates";
import { randomUUID } from "node:crypto";
import type { NewsCollection, RepositoryCollection } from "@/lib/types";
import type { PipelineStore, PipelineResult } from "./types";
import type { Editor } from "@/lib/editorial/types";
import { validateEvaluations } from "@/lib/editorial/editor";
import { isPartial } from "@/lib/editorial/copy";
import { prepareCandidates } from "@/lib/editorial/prepare";
import {
  recheckHistory,
  applyEvaluations,
  remainingArticles,
  applyExtractions,
  readyToPublish,
} from "./progress";

type Dependencies = {
  store: PipelineStore;
  editor: Editor;
  collect: () => Promise<NewsCollection>;
  radar: () => Promise<RepositoryCollection>;
  now?: () => number;
  budgetMs?: number;
  radarSourceCount?: number;
};
export async function runPipeline(date: string, deps: Dependencies): Promise<PipelineResult> {
  if (!validDate(date)) throw new Error("Expected a real date in YYYY-MM-DD format");
  const { store, editor } = deps;
  const now = deps.now ?? Date.now;
  const deadline = now() + (deps.budgetMs ?? 220000);
  const runId = randomUUID();
  const claim = await store.claim(date, runId);
  if (claim.status !== "acquired")
    return { status: claim.status === "published" ? "already-published" : "busy", date };
  let cp = claim.checkpoint;
  const pending = async (): Promise<PipelineResult> => {
    await store.release(date, runId);
    return { status: "pending", date, outcomes: cp?.outcomes };
  };
  try {
    // Fail closed if publication history cannot be read. Source failures may be
    // partial; a missing history must never silently permit yesterday's stories.
    const history = await store.recentArticles(date);
    if (cp) {
      const restored = recheckHistory(cp, history);
      if (restored !== cp) await store.save(date, runId, restored);
      cp = restored;
    }
    if (!cp) {
      const [collection, radar] = await Promise.allSettled([deps.collect(), deps.radar()]);
      if (collection.status === "rejected" || collection.value.articles.length === 0)
        throw new Error("No usable source material; edition not published");
      const { reports } = collection.value;
      const prepared = prepareCandidates(collection.value, history);
      cp = {
        collectedAt: new Date(now()).toISOString(),
        phase: "evaluate",
        articles: prepared.articles,
        selected: [],
        stories: [],
        repositories: radar.status === "fulfilled" ? radar.value.repositories : [],
        reports,
        themes: prepared.themes,
        outcomes: {
          ...prepared.counts,
          evaluated: 0,
          selected: 0,
          summaries: 0,
          sourcesUnavailable:
            prepared.counts.sourcesUnavailable +
            (radar.status === "fulfilled" ? radar.value.unavailable : (deps.radarSourceCount ?? 3)),
          repositories: radar.status === "fulfilled" ? radar.value.repositories.length : 0,
          releaseFailures: radar.status === "fulfilled" ? radar.value.releaseFailures : 0,
          summaryFailures: 0,
        },
      };
      await store.save(date, runId, cp);
    }
    if (cp.phase === "evaluate") {
      if (deadline - now() < 5000) return pending();
      const evaluations = validateEvaluations(cp.articles, await editor.evaluate(cp.articles));
      cp = applyEvaluations(cp, evaluations, new Date(cp.collectedAt ?? `${date}T00:00:00Z`));
      if (!cp.selected.length) {
        // A quiet day is a business outcome, not a processing failure. The later
        // retry may collect genuinely new material instead of replaying an empty checkpoint.
        await store.release(date, runId, undefined, true);
        return { status: "no-new-stories", date, outcomes: cp.outcomes };
      }
      await store.save(date, runId, cp);
    }
    if (cp.phase === "summarize") {
      const remaining = remainingArticles(cp);
      for (let i = 0; i < remaining.length; i += 3) {
        if (deadline - now() < 5000) return pending();
        const batch = remaining.slice(i, i + 3);
        const results = await Promise.allSettled(batch.map((a) => editor.summarize(a)));
        cp = applyExtractions(cp, results);
        await store.save(date, runId, cp);
      }
      if (!cp.stories.length) throw new Error("No readable source excerpts; edition not published");
      cp = readyToPublish(cp);
      await store.save(date, runId, cp);
    }
    await store.publish(date, runId, cp);
    return {
      status: "published",
      date,
      partial: isPartial(cp),
      outcomes: cp.outcomes,
    };
  } catch (error) {
    // Avoid persisting provider messages, which can contain credentials or source text.
    try {
      await store.release(
        date,
        runId,
        "Generation failed. Retry the same date to resume saved progress.",
      );
    } catch {
      // Preserve the processing error; cleanup cannot replace it.
      // A lease that could not be released remains recoverable through expiry.
    }
    throw error;
  }
}
