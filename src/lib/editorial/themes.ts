import "server-only";
import type { Article, Theme } from "@/lib/types";
import type { Evaluation } from "@/lib/editorial/types";
import { publisherFor } from "@/lib/sources/registry";
import { stem, stopWords, words } from "./curation";

// Extract recurring phrases from fresh source material. Counts describe this
// collection only; there is no claim of internet-wide popularity or momentum.
export function discoverThemes(articles: Article[], evaluations: Evaluation[]): Theme[] {
  const accepted = new Set(
    evaluations.filter((e) => e.score >= 60 && !e.duplicateOf).map((e) => e.id),
  );
  const phrases = new Map<string, { label: string; articles: Map<string, Article> }>();
  for (const article of articles.filter((a) => accepted.has(a.id))) {
    const tokens = words(`${article.title}. ${article.content.slice(0, 900)}`);
    const seen = new Set<string>();
    for (let size = 2; size <= 3; size++)
      for (let i = 0; i + size <= tokens.length; i++) {
        const group = tokens.slice(i, i + size);
        if (group.some((token) => stopWords.has(token) || token.length < 3 || /\d/.test(token)))
          continue;
        const key = group.map(stem).join(" ");
        if (seen.has(key)) continue;
        seen.add(key);
        const phrase = phrases.get(key) ?? { label: group.join(" "), articles: new Map() };
        phrase.articles.set(article.id, article);
        phrases.set(key, phrase);
      }
  }
  const ranked = [...phrases.entries()]
    .map(([key, phrase]) => ({
      key,
      ...phrase,
      publishers: new Set([...phrase.articles.values()].map((a) => publisherFor(a.sourceId))),
    }))
    .filter(
      (p) =>
        p.articles.size >= 2 &&
        p.publishers.size >= 2 &&
        [...p.articles.values()].some((a) => words(a.title).map(stem).join(" ").includes(p.key)),
    )
    .sort(
      (a, b) =>
        b.publishers.size - a.publishers.size ||
        b.articles.size - a.articles.size ||
        b.key.split(" ").length - a.key.split(" ").length ||
        a.key.localeCompare(b.key),
    );
  const selected: typeof ranked = [];
  for (const phrase of ranked) {
    if (
      selected.some((other) => {
        const overlap = [...phrase.articles.keys()].filter((id) => other.articles.has(id)).length;
        return (
          overlap / new Set([...phrase.articles.keys(), ...other.articles.keys()]).size > 0.6 ||
          other.key.includes(phrase.key) ||
          phrase.key.includes(other.key)
        );
      })
    )
      continue;
    selected.push(phrase);
    if (selected.length === 3) break;
  }
  return selected.map((phrase) => ({
    title: phrase.label[0].toUpperCase() + phrase.label.slice(1),
    summary: `A recurring phrase in ${phrase.articles.size} recent articles from ${phrase.publishers.size} independent publisher groups. Explore the sources to see the different perspectives.`,
    publisherCount: phrase.publishers.size,
    sources: [...phrase.articles.values()]
      .map((a) => ({ articleId: a.id, title: a.title, url: a.url, sourceName: a.sourceName }))
      .slice(0, 5),
  }));
}
