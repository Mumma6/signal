import type { Editor } from "./types";
import { observe } from "@/lib/observability";
import { evaluateArticles } from "@/lib/editorial/curation";
import { extractStory, validateEvaluations } from "@/lib/editorial/excerpts";

// Application instrumentation wraps a pure, provider-free editor.
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
        async () => extractStory(article),
        () => ({ excerptsCreated: 1 }),
      ),
  };
}
