import "server-only";
import type { Article, Story } from "@/lib/types";
import type { Evaluation, PublishedArticle, SelectedArticle } from "@/lib/editorial/types";
import { unpublishedArticles } from "@/lib/editorial/novelty";
import { selectArticles } from "@/lib/editorial/selection";
import { discoverThemes } from "@/lib/editorial/themes";
import type { Checkpoint } from "./types";

export function recheckHistory(checkpoint: Checkpoint, history: PublishedArticle[]): Checkpoint {
  const articles = unpublishedArticles(checkpoint.articles, history);
  const removed = checkpoint.articles.length - articles.length;
  if (!removed) return checkpoint;
  return {
    ...checkpoint,
    phase: "evaluate",
    articles,
    selected: [],
    stories: [],
    outcomes: {
      ...checkpoint.outcomes,
      previouslyPublished: (checkpoint.outcomes.previouslyPublished ?? 0) + removed,
      rejected: checkpoint.outcomes.collected - checkpoint.outcomes.duplicates - articles.length,
      evaluated: 0,
      selected: 0,
      summaries: 0,
      summaryFailures: 0,
    },
  };
}
export function applyEvaluations(
  checkpoint: Checkpoint,
  evaluations: Evaluation[],
  now: Date,
): Checkpoint {
  const selected = selectArticles(checkpoint.articles, evaluations, now);
  return {
    ...checkpoint,
    phase: "summarize",
    selected,
    themes: checkpoint.themes ?? discoverThemes(checkpoint.articles, evaluations),
    outcomes: {
      ...checkpoint.outcomes,
      evaluated: evaluations.length,
      selected: selected.length,
      rejected: checkpoint.outcomes.rejected + evaluations.length - selected.length,
    },
  };
}
export function remainingArticles(checkpoint: Checkpoint): SelectedArticle[] {
  const completed = new Set(checkpoint.stories.map((story) => story.id));
  return checkpoint.selected.filter((article) => !completed.has(article.id));
}
export function applyExtractions(
  checkpoint: Checkpoint,
  results: PromiseSettledResult<Story>[],
): Checkpoint {
  const stories = [
    ...checkpoint.stories,
    ...results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
  ];
  return {
    ...checkpoint,
    stories,
    outcomes: {
      ...checkpoint.outcomes,
      summaries: stories.length,
      summaryFailures:
        checkpoint.outcomes.summaryFailures +
        results.filter((result) => result.status === "rejected").length,
    },
  };
}
export function readyToPublish(checkpoint: Checkpoint): Checkpoint {
  const order = new Map<string, number>(
    checkpoint.selected.map((article: Article, index) => [article.id, index]),
  );
  return {
    ...checkpoint,
    phase: "publish",
    stories: [...checkpoint.stories].sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    ),
  };
}
