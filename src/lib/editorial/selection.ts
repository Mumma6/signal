import "server-only";
import type { Article, Category } from "@/lib/types";
import type { Evaluation } from "./types";
import { publisherFor } from "@/lib/sources/registry";
export function selectArticles(
  articles: readonly Article[],
  evaluations: readonly Evaluation[],
  now = new Date(),
): (Article & { category: Category })[] {
  const byId = new Map(articles.map((a) => [a.id, a]));
  const publishers = new Map<string, number>();
  const categories = new Map<Category, number>();
  const selected: (Article & { category: Category })[] = [];
  const remaining = evaluations
    .filter((e) => e.score >= 60 && e.duplicateOf === null)
    .map((evaluation) => {
      const article = byId.get(evaluation.id);
      if (!article) throw new Error("Selection refers to an unknown article");
      return { evaluation, article };
    });
  const priority = ({ evaluation, article }: (typeof remaining)[number]) => {
    const ageHours = Math.max(0, (now.getTime() - Date.parse(article.publishedAt)) / 3600000);
    return (
      evaluation.score +
      Math.max(0, 8 - ageHours / 6) -
      (publishers.get(publisherFor(article.sourceId)) ?? 0) * 16 -
      (categories.get(evaluation.category) ?? 0) * 4
    );
  };
  while (remaining.length && selected.length < 6) {
    remaining.sort(
      (a, b) =>
        priority(b) - priority(a) ||
        b.article.publishedAt.localeCompare(a.article.publishedAt) ||
        a.article.id.localeCompare(b.article.id),
    );
    const candidate = remaining.shift();
    if (!candidate) break;
    const { evaluation, article } = candidate;
    const publisher = publisherFor(article.sourceId);
    if ((publishers.get(publisher) ?? 0) >= 2) continue;
    if (
      ["codex", "claude-code"].includes(article.sourceId) &&
      selected.some((a) => a.sourceId === article.sourceId)
    )
      continue;
    selected.push({ ...article, category: evaluation.category });
    publishers.set(publisher, (publishers.get(publisher) ?? 0) + 1);
    categories.set(evaluation.category, (categories.get(evaluation.category) ?? 0) + 1);
  }
  return selected;
}
