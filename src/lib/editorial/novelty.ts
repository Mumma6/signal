import "server-only";
import type { Article } from "@/lib/types";
import { canonicalUrl } from "@/lib/urls";
import { sameDevelopment } from "./curation";

type PublishedArticle = Pick<Article, "id" | "url" | "title" | "sourceId">;
const headline = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function unpublishedArticles(articles: Article[], history: PublishedArticle[]) {
  const ids = new Set(history.map((a) => a.id));
  const urls = new Set(history.map((a) => canonicalUrl(a.url)));
  return articles.filter(
    (a) =>
      !ids.has(a.id) &&
      !urls.has(canonicalUrl(a.url)) &&
      !history.some(
        (previous) =>
          // Bare version headlines belong to their own release feed.
          (headline(previous.title) === headline(a.title) &&
            (previous.sourceId === a.sourceId || !/^v?\d+(?:\.\d+)+$/i.test(a.title.trim()))) ||
          sameDevelopment(a, previous),
      ),
  );
}

export function deduplicate(articles: readonly Article[]) {
  const urls = new Set<string>();
  const titles = new Set<string>();
  return articles.filter((article) => {
    const title = article.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    if (urls.has(article.url) || titles.has(title)) return false;
    urls.add(article.url);
    titles.add(title);
    return true;
  });
}
