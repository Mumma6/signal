import { categorySchema } from "@/lib/schemas";
import { z } from "zod";
import type { Article, Story } from "@/lib/types";
import type { Evaluation, SelectedArticle } from "./types";
import { selectionContext, sourceExcerpt } from "./curation";
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
const evaluationSchema = z.object({
  id: z.string(),
  score: z.number().int().min(0).max(100),
  category: categorySchema,
  duplicateOf: z.string().nullable(),
  reason: z.string(),
});
export function validateEvaluations(articles: Article[], evaluations: Evaluation[]) {
  evaluationSchema.array().parse(evaluations);
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
export function extractStory(article: SelectedArticle): Story {
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
  };
}
