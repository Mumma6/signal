import type { Article } from "@/lib/types";
import { publisherFor } from "./registry";

// Multiple feeds from one publisher share a quota; a busy vendor release feed
// cannot crowd out independent blogs, community posts, and research.
export function balanceCandidates(articles: Article[], limit = 36) {
  const groups = new Map<string, Article[]>();
  for (const article of articles) {
    const publisher = publisherFor(article.sourceId);
    const group = groups.get(publisher) ?? [];
    group.push(article);
    groups.set(publisher, group);
  }
  const queues = [...groups.values()].map((group) =>
    group
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id))
      .slice(0, 4),
  );
  const candidates: Article[] = [];
  for (let i = 0; i < 4 && candidates.length < limit; i++) {
    for (const queue of queues)
      if (queue[i] && candidates.length < limit) candidates.push(queue[i]);
  }
  return candidates;
}
