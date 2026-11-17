import { randomUUID } from "node:crypto";
import type { Article, CollectionReport, Repository } from "@/lib/types";
import type { Editor, PipelineStore, PipelineResult } from "./types";
import { deduplicate } from "@/lib/sources/normalize";
import { selectArticles, validateEvaluations } from "./editor";
import { observe } from "@/lib/observability";
import { isPartial } from "./copy";
import { radarTopics } from "@/lib/sources/github";
import { balanceCandidates } from "@/lib/sources/balance";
import { discoverThemes } from "./themes";
import { evaluateArticles } from "./curation";
import { unpublishedArticles } from "./novelty";

type Dependencies = {
  store: PipelineStore;
  editor: Editor;
  collect: () => Promise<{
    articles: Article[];
    contextArticles?: Article[];
    reports: CollectionReport[];
  }>;
  radar: () => Promise<{
    repositories: Repository[];
    unavailable: number;
    releaseFailures: number;
  }>;
  now?: () => number;
  budgetMs?: number;
};
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
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
      const fresh = unpublishedArticles(cp.articles, history);
      const removed = cp.articles.length - fresh.length;
      if (removed) {
        cp.articles = fresh;
        cp.selected = [];
        cp.stories = [];
        cp.phase = "evaluate";
        cp.outcomes.previouslyPublished = (cp.outcomes.previouslyPublished ?? 0) + removed;
        cp.outcomes.rejected = cp.outcomes.collected - cp.outcomes.duplicates - fresh.length;
        cp.outcomes.evaluated = 0;
        cp.outcomes.selected = 0;
        cp.outcomes.summaries = 0;
        cp.outcomes.summaryFailures = 0;
        await store.save(date, runId, cp);
      }
    }
    if (!cp) {
      const [collection, radar] = await Promise.allSettled([deps.collect(), deps.radar()]);
      if (collection.status === "rejected" || collection.value.articles.length === 0)
        throw new Error("No usable source material; edition not published");
      const { articles: raw, reports } = collection.value;
      const unique = await observe(
        "article.processing",
        async () => deduplicate(raw),
        (result) => ({ collected: raw.length, duplicates: raw.length - result.length }),
      );
      const fresh = await observe(
        "article.novelty",
        async () => unpublishedArticles(unique, history),
        (result) => ({ previouslyPublished: unique.length - result.length, fresh: result.length }),
      );
      const candidates = balanceCandidates(fresh);
      const themeCandidates = balanceCandidates(
        deduplicate(collection.value.contextArticles ?? raw),
        60,
      );
      const themes = await observe(
        "article.themes",
        async () => discoverThemes(themeCandidates, evaluateArticles(themeCandidates)),
        (result) => ({ themes: result.length }),
      );
      cp = {
        collectedAt: new Date(now()).toISOString(),
        phase: "evaluate",
        articles: candidates,
        selected: [],
        stories: [],
        repositories: radar.status === "fulfilled" ? radar.value.repositories : [],
        reports,
        themes,
        outcomes: {
          previouslyPublished: unique.length - fresh.length,
          collected: raw.length,
          duplicates: raw.length - unique.length,
          invalid: reports.reduce((n, r) => n + r.invalid, 0),
          evaluated: 0,
          selected: 0,
          rejected: unique.length - candidates.length,
          summaries: 0,
          sourcesUnavailable:
            reports.filter((r) => r.status === "unavailable").length +
            (radar.status === "fulfilled" ? radar.value.unavailable : radarTopics.length),
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
      cp.selected = selectArticles(
        cp.articles,
        evaluations,
        new Date(cp.collectedAt ?? `${date}T00:00:00Z`),
      );
      cp.themes ??= discoverThemes(cp.articles, evaluations);
      cp.outcomes.evaluated = evaluations.length;
      cp.outcomes.selected = cp.selected.length;
      cp.outcomes.rejected += evaluations.length - cp.selected.length;
      if (!cp.selected.length) {
        // A quiet day is a business outcome, not a processing failure. The later
        // retry may collect genuinely new material instead of replaying an empty checkpoint.
        await store.release(date, runId, undefined, true);
        return { status: "no-new-stories", date, outcomes: cp.outcomes };
      }
      cp.phase = "summarize";
      await store.save(date, runId, cp);
    }
    if (cp.phase === "summarize") {
      const remaining = cp.selected.filter((a) => !cp!.stories.some((s) => s.id === a.id));
      for (let i = 0; i < remaining.length; i += 3) {
        if (deadline - now() < 5000) return pending();
        const batch = remaining.slice(i, i + 3);
        const results = await Promise.allSettled(batch.map((a) => editor.summarize(a)));
        for (const result of results) {
          if (result.status === "fulfilled") cp.stories.push(result.value);
          else cp.outcomes.summaryFailures++;
        }
        cp.outcomes.summaries = cp.stories.length;
        await store.save(date, runId, cp);
      }
      if (!cp.stories.length) throw new Error("No readable source excerpts; edition not published");
      const order = new Map(cp.selected.map((a, i) => [a.id, i]));
      cp.stories.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
      cp.phase = "publish";
      await store.save(date, runId, cp);
    }
    await observe(
      "briefing.publication",
      () => store.publish(date, runId, cp!),
      () => ({
        briefingsPublished: 1,
        articlesSelected: cp!.stories.length,
        partial: isPartial(cp!),
      }),
    );
    return {
      status: "published",
      date,
      partial: isPartial(cp),
      outcomes: cp.outcomes,
    };
  } catch (error) {
    // Avoid persisting provider messages, which can contain credentials or source text.
    await store.release(
      date,
      runId,
      "Generation failed. Inspect structured process logs and retry the same date.",
    );
    throw error;
  }
}
