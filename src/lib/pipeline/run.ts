import "server-only";
import { validDate } from "@/lib/dates";
import { randomUUID } from "node:crypto";
import type { Flow } from "@flowmarkdev/node";
import type { NewsCollection, Outcomes, RepositoryCollection } from "@/lib/types";
import type { Checkpoint, PipelineStore, PipelineResult } from "./types";
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
  startRun?: (executionId?: string) => Flow | null;
};
export async function runPipeline(date: string, deps: Dependencies): Promise<PipelineResult> {
  if (!validDate(date)) throw new Error("Expected a real date in YYYY-MM-DD format");
  const { store, editor } = deps;
  const now = deps.now ?? Date.now;
  const deadline = now() + (deps.budgetMs ?? 220000);
  const runId = randomUUID();
  const claim = await store.claim(date, runId);
  let flow: Flow | null = null;
  let closed = false;
  const closeRun = (result: PipelineResult): PipelineResult => {
    closed = true;
    recordProgress(flow, result.outcomes);
    try {
      flow?.done({ outcome: outcomeFor(result), result: reportedResult(result) });
    } catch {
      console.warn("[Flowmark] instrumentation failed");
    }
    return result;
  };
  if (claim.status !== "acquired") {
    flow = deps.startRun?.() ?? null;
    return closeRun({
      status: claim.status === "published" ? "already-published" : "busy",
      date,
    });
  }
  let cp = claim.checkpoint;
  flow = deps.startRun?.(cp?.executionId) ?? null;
  const executionId = cp?.executionId ?? flow?.runId;
  const pending = async (): Promise<PipelineResult> => {
    recordProgress(flow, cp?.outcomes);
    await store.release(date, runId);
    return { status: "pending", date, outcomes: cp?.outcomes };
  };
  try {
    // Fail closed if publication history cannot be read. Source failures may be
    // partial; a missing history must never silently permit yesterday's stories.
    const history = await measured(flow, "read-history", () => store.recentArticles(date));
    if (cp) {
      const restored = recheckHistory(cp, history);
      const stamped =
        executionId && restored.executionId !== executionId
          ? { ...restored, executionId }
          : restored;
      if (stamped !== cp) await store.save(date, runId, stamped);
      cp = stamped;
      mark(flow, "checkpoint-resumed");
    } else mark(flow, "lease-acquired");
    if (!cp) {
      const [collection, radar] = await measured(flow, "collect-sources", () =>
        Promise.allSettled([deps.collect(), deps.radar()]),
      );
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
        ...(executionId ? { executionId } : {}),
      };
      await store.save(date, runId, cp);
      mark(flow, "sources-collected", {
        collected: prepared.counts.collected,
        rejected: prepared.counts.rejected,
        duplicates: prepared.counts.duplicates,
      });
    }
    if (cp.phase === "evaluate") {
      if (deadline - now() < 5000) return pending();
      const articles = cp.articles;
      const evaluations = validateEvaluations(
        articles,
        await measured(flow, "evaluate", () => editor.evaluate(articles)),
      );
      cp = applyEvaluations(cp, evaluations, new Date(cp.collectedAt ?? `${date}T00:00:00Z`));
      if (!cp.selected.length) {
        // A quiet day is a business outcome, not a processing failure. The later
        // retry may collect genuinely new material instead of replaying an empty checkpoint.
        await store.release(date, runId, undefined, true);
        mark(flow, "no-new-stories");
        return closeRun({ status: "no-new-stories", date, outcomes: cp.outcomes });
      }
      await store.save(date, runId, cp);
    }
    if (cp.phase === "summarize") {
      let paused = false;
      await measured(flow, "extract-excerpts", async () => {
        const remaining = remainingArticles(cp as Checkpoint);
        for (let i = 0; i < remaining.length; i += 3) {
          if (deadline - now() < 5000) {
            paused = true;
            return;
          }
          const batch = remaining.slice(i, i + 3);
          const results = await Promise.allSettled(batch.map((a) => editor.summarize(a)));
          cp = applyExtractions(cp as Checkpoint, results);
          await store.save(date, runId, cp);
        }
      });
      if (paused) return pending();
      if (!cp.stories.length) throw new Error("No readable source excerpts; edition not published");
      cp = readyToPublish(cp);
      await store.save(date, runId, cp);
    }
    await measured(flow, "publish", () => store.publish(date, runId, cp as Checkpoint));
    return closeRun({
      status: "published",
      date,
      partial: isPartial(cp),
      outcomes: cp.outcomes,
    });
  } catch (error) {
    // Avoid persisting provider messages, which can contain credentials or source text.
    // A failed attempt closes this execution. The saved checkpoint can resume, and the
    // next attempt records a new execution instead of appending to a finished run.
    if (!closed) {
      try {
        flow?.fail({ code: "BRIEFING_FAILED", retryable: true });
      } catch {
        console.warn("[Flowmark] instrumentation failed");
      }
      if (cp?.executionId) {
        try {
          const checkpoint = { ...cp };
          delete checkpoint.executionId;
          await store.save(date, runId, checkpoint);
        } catch {
          // Keep the processing error. Cleanup cannot replace it.
        }
      }
    }
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

function mark(flow: Flow | null, name: string, properties?: Record<string, number>): void {
  try {
    flow?.step(name, properties ? { properties } : undefined);
  } catch {
    console.warn("[Flowmark] instrumentation failed");
  }
}
async function measured<T>(
  flow: Flow | null,
  name: string,
  callback: () => Promise<T>,
): Promise<T> {
  if (!flow) return callback();
  return flow.operation(name, callback);
}
function outcomeFor(result: PipelineResult): string {
  if (result.status === "published") return result.partial ? "partial" : "published";
  return result.status;
}
function recordProgress(flow: Flow | null, outcomes?: Outcomes) {
  if (!flow || !outcomes) return;
  try {
    flow.progress({
      completed: outcomes.summaries,
      total: Math.max(outcomes.summaries, outcomes.selected),
      unit: "excerpts",
    });
  } catch {
    console.warn("[Flowmark] instrumentation failed");
  }
}
function reportedResult(result: PipelineResult) {
  const summary: Record<string, string | number | boolean> = { status: result.status };
  if (
    result.status !== "published" &&
    result.status !== "pending" &&
    result.status !== "no-new-stories"
  )
    return summary;
  if (result.status === "published") summary.partial = result.partial;
  const outcomes = result.outcomes;
  if (!outcomes) return summary;
  return {
    ...summary,
    collected: outcomes.collected,
    duplicates: outcomes.duplicates,
    invalid: outcomes.invalid,
    rejected: outcomes.rejected,
    selected: outcomes.selected,
    summaries: outcomes.summaries,
    sourcesUnavailable: outcomes.sourcesUnavailable,
    repositories: outcomes.repositories,
    releaseFailures: outcomes.releaseFailures,
    summaryFailures: outcomes.summaryFailures,
    ...(outcomes.previouslyPublished === undefined
      ? {}
      : { previouslyPublished: outcomes.previouslyPublished }),
  };
}
