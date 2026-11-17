import "server-only";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import type { Article, CollectionReport } from "@/lib/types";
import { fetchText } from "./http";
import { normalizeArticle } from "./normalize";
import { mapSettled } from "@/lib/concurrency";
import { sourceDefinitions, type SourceDefinition } from "./registry";
import { parseAnthropic, parseXaiNotes, type RawArticle } from "./pages";

const hnSchema = z.object({
  hits: z.array(
    z.object({
      title: z.string().nullable(),
      url: z.string().nullable(),
      story_text: z.string().nullable().optional(),
      created_at: z.string(),
    }),
  ),
});
type FeedText = string | { "#text"?: string };
type FeedEntry = {
  title?: FeedText;
  link?:
    string | { "@_href"?: string; "@_rel"?: string }[] | { "@_href"?: string; "@_rel"?: string };
  description?: FeedText;
  "content:encoded"?: FeedText;
  content?: FeedText;
  summary?: FeedText;
  pubDate?: string;
  published?: string;
  updated?: string;
  id?: string;
};
const feedText = (value?: FeedText) => (typeof value === "string" ? value : value?.["#text"]);
export function parseFeed(xml: string, kind: "rss" | "atom"): FeedEntry[] {
  // HTML doctypes inside CDATA are source text, not XML declarations.
  const declarations = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  if (/<!DOCTYPE|<!ENTITY/i.test(declarations) || XMLValidator.validate(xml) !== true)
    throw new Error("Invalid feed XML");
  const data = new XMLParser({ ignoreAttributes: false, processEntities: true }).parse(xml);
  // Some publishers negotiate RSS/Atom at the same feed URL.
  const root =
    (kind === "rss" ? data?.rss?.channel : data?.feed) ?? data?.rss?.channel ?? data?.feed;
  if (root === undefined || root === null) throw new Error("Expected an RSS or Atom feed");
  const items = root.item ?? root.entry;
  if (!items) return [];
  return (Array.isArray(items) ? items : [items]).slice(0, 20);
}
function atomLink(entry: FeedEntry) {
  if (typeof entry.link === "string") return entry.link;
  const links = Array.isArray(entry.link) ? entry.link : [entry.link];
  return (
    links.find((link) => link?.["@_rel"] === "alternate")?.["@_href"] ??
    links[0]?.["@_href"] ??
    entry.id
  );
}
export function parseSource(text: string, source: SourceDefinition): RawArticle[] {
  if (source.kind === "anthropic") return parseAnthropic(text);
  if (source.kind === "xai") return parseXaiNotes(text);
  if (source.kind === "hn")
    return hnSchema.parse(JSON.parse(text)).hits.map((item) => ({
      title: item.title,
      url: item.url,
      content: item.story_text,
      publishedAt: item.created_at,
    }));
  return parseFeed(text, source.kind)
    .filter(
      (item) =>
        !["codex", "claude-code"].includes(source.id) ||
        !/\b(?:alpha|beta|rc|nightly)(?:[.\d-]|\b)/i.test(feedText(item.title) ?? ""),
    )
    .map((item) => ({
      title: feedText(item.title),
      url: atomLink(item),
      content:
        feedText(item["content:encoded"]) ||
        feedText(item.content) ||
        feedText(item.description) ||
        feedText(item.summary),
      publishedAt: item.pubDate || item.published || item.updated,
    }));
}

export async function collectArticles(
  now = new Date(),
  read: typeof fetchText = fetchText,
  definitions: readonly SourceDefinition[] = sourceDefinitions,
) {
  const results = await mapSettled(definitions, 4, async (source) => {
    const raw = parseSource(await read(source.url), source);
    const articles = raw
      .map((item) => normalizeArticle(item, source, now))
      .filter((item): item is Article => item !== null);
    const contextArticles = raw
      .map((item) => normalizeArticle(item, source, now, 168))
      .filter((item): item is Article => item !== null);
    return {
      articles,
      contextArticles,
      report: {
        source: source.id,
        count: articles.length,
        invalid: raw.length - articles.length,
        status: "ok" as const,
      },
    };
  });
  const articles: Article[] = [];
  const contextArticles: Article[] = [];
  const reports: CollectionReport[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      articles.push(...result.value.articles);
      contextArticles.push(...result.value.contextArticles);
      reports.push(result.value.report);
    } else reports.push({ source: definitions[i].id, count: 0, invalid: 0, status: "unavailable" });
  });
  return { articles, contextArticles, reports };
}
