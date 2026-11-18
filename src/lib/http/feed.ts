import "server-only";
import type { Edition } from "../types";
export function escapeXml(text: string) {
  return text.replace(
    /[<>&"']/g,
    (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!,
  );
}
export function editionFeed(edition: Edition | null, site: string) {
  const base = new URL(site).origin;
  const items = edition
    ? edition.stories
        .map((story) => {
          const title = `${edition.sample ? (edition.sampleKind === "source-snapshot" ? "[Source snapshot] " : "[Historical sample] ") : ""}${story.title}`;
          return `<item><title>${escapeXml(title)}</title><link>${escapeXml(story.url)}</link><guid isPermaLink="false">${escapeXml(`${base}/briefing/${edition.date}#story-${story.id}`)}</guid><pubDate>${new Date(story.publishedAt).toUTCString()}</pubDate><description>${escapeXml(`${story.summary}\n\n${story.summaryKind === "source-excerpt" ? "Selection context" : "Why it matters (editorial perspective)"}: ${story.whyItMatters}\n\nSource: ${story.sourceName}`)}</description><category>${escapeXml(story.category)}</category></item>`;
        })
        .join("")
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Signal — The daily AI briefing${edition?.sample ? " (sample edition)" : ""}</title><link>${escapeXml(base)}</link><description>Stay ahead of AI. Without the noise.</description><language>en</language><atom:link href="${escapeXml(base)}/feed.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
}
