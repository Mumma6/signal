import { z } from "zod";
import type { Article, Story, Category } from "@/lib/types";
import type { Editor, Evaluation } from "./types";
import { observe } from "@/lib/observability";
import { evaluateArticles, selectionContext, sourceExcerpt } from "./curation";
import { publisherFor } from "@/lib/sources/registry";

export const summarySchema = z.object({
  summary: z.string().min(60).max(550),
  whyItMatters: z.string().min(30).max(350),
  evidence: z
    .array(z.string().min(20).max(220))
    .min(1)
    .max(3)
    .refine(
      (quotes) => quotes.join(" ").split(/\s+/).length <= 25,
      "Source excerpts must total at most 25 words",
    ),
});
export function validateEvaluations(articles: Article[], evaluations: Evaluation[]) {
  const ids = new Set(articles.map((a) => a.id));
  const seen = new Set<string>();
  for (const item of evaluations) {
    if (
      !ids.has(item.id) ||
      seen.has(item.id) ||
      item.duplicateOf === item.id ||
      (item.duplicateOf !== null && !ids.has(item.duplicateOf))
    )
      throw new Error("Editor returned invalid article references");
    seen.add(item.id);
  }
  if (seen.size !== ids.size) throw new Error("Editor omitted article evaluations");
  for (const item of evaluations)
    if (
      item.duplicateOf &&
      evaluations.find((e) => e.id === item.duplicateOf)?.duplicateOf !== null
    )
      throw new Error("Invalid duplicate group");
  return evaluations;
}
export function validateGrounding(article: Article, draft: z.infer<typeof summarySchema>) {
  const text = `${article.title} ${article.content}`;
  if (draft.evidence.some((quote) => !text.includes(quote)))
    throw new Error("Evidence is not present in the source");
  for (const number of draft.summary.match(/\d+(?:[.,]\d+)*(?:%|B|M|K)?/g) ?? [])
    if (!text.includes(number)) throw new Error("Unsupported numerical claim");
  if (/[“”"]/.test(draft.summary) && !article.content.includes(draft.summary))
    throw new Error("Unsupported quotation");
  return draft;
}
// Local rules only: no model client, credentials, remote inference, or usage charges.
export function createEditor(): Editor {
  return {
    evaluate: (articles) =>
      observe(
        "article.relevance",
        async () => validateEvaluations(articles, evaluateArticles(articles)),
        (result) => ({
          evaluated: result.length,
          rejected: result.filter((e) => e.score < 60 || e.duplicateOf !== null).length,
        }),
      ),
    summarize: (article) =>
      observe(
        "article.extraction",
        async () => {
          const excerpt = sourceExcerpt(article.content);
          const draft = validateGrounding(
            article,
            summarySchema.parse({
              summary: excerpt,
              whyItMatters: selectionContext(article, article.category),
              evidence: [excerpt],
            }),
          );
          return {
            id: article.id,
            title: article.title,
            url: article.url,
            sourceName: article.sourceName,
            publishedAt: article.publishedAt,
            category: article.category,
            ...draft,
            summaryKind: "source-excerpt",
          } satisfies Story;
        },
        () => ({ excerptsCreated: 1 }),
      ),
  };
}
export function selectArticles(
  articles: Article[],
  evaluations: Evaluation[],
): (Article & { category: Category })[] {
  const byId = new Map(articles.map((a) => [a.id, a]));
  const publishers = new Map<string, number>();
  const selected: (Article & { category: Category })[] = [];
  for (const evaluation of evaluations
    .filter((e) => e.score >= 60 && e.duplicateOf === null)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))) {
    const article = byId.get(evaluation.id)!;
    const publisher = publisherFor(article.sourceId);
    if ((publishers.get(publisher) ?? 0) >= 2) continue;
    if (
      ["codex", "claude-code"].includes(article.sourceId) &&
      selected.some((a) => a.sourceId === article.sourceId)
    )
      continue;
    selected.push({ ...article, category: evaluation.category });
    publishers.set(publisher, (publishers.get(publisher) ?? 0) + 1);
    if (selected.length === 6) break;
  }
  return selected;
}
