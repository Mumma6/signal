import "server-only";
import type { NewsCollection, Outcomes } from "@/lib/types";
import type { PublishedArticle } from "./types";
import { deduplicate, unpublishedArticles } from "./novelty";
import { balanceCandidates } from "./balance";
import { discoverThemes } from "./themes";
import { evaluateArticles } from "./curation";

// Shared by scheduled publication, previews and owner corrections. No I/O,
// environment reads, clock reads, or mutation of the supplied collection.
export function prepareCandidates(collection: NewsCollection, history: PublishedArticle[] = []) {
  const unique = deduplicate(collection.articles);
  const fresh = unpublishedArticles(unique, history);
  const articles = balanceCandidates(fresh);
  const context = balanceCandidates(
    deduplicate(collection.contextArticles ?? collection.articles),
    60,
  );
  return {
    articles,
    themes: discoverThemes(context, evaluateArticles(context)),
    counts: {
      collected: collection.articles.length,
      duplicates: collection.articles.length - unique.length,
      previouslyPublished: unique.length - fresh.length,
      invalid: collection.reports.reduce((sum, report) => sum + report.invalid, 0),
      rejected: unique.length - articles.length,
      sourcesUnavailable: collection.reports.filter((report) => report.status === "unavailable")
        .length,
    } satisfies Pick<
      Outcomes,
      | "collected"
      | "duplicates"
      | "previouslyPublished"
      | "invalid"
      | "rejected"
      | "sourcesUnavailable"
    >,
  };
}
