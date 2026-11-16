import { createHash } from "node:crypto";
import { load } from "cheerio";
import { articleSchema, type Article } from "@/lib/types";

export function canonicalUrl(input: string) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Invalid article URL");
  // No local addresses in public source links. These are links only, never fetched.
  if (
    url.hostname === "localhost" ||
    !url.hostname.includes(".") ||
    /^[\d.:\[\]]+$/.test(url.hostname)
  )
    throw new Error("Non-public article URL");
  url.hash = "";
  for (const key of [...url.searchParams.keys()])
    if (/^(utm_.+|fbclid|gclid|ref)$/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/$/, "") || "/";
  return url.toString();
}
export function plainText(input: unknown): string {
  if (typeof input !== "string") return "";
  const $ = load(input);
  $("script,style").remove();
  $("br,p,div,li,h1,h2,h3,h4,pre").each((_, element) => {
    $(element).prepend(" ");
    $(element).append(" ");
  });
  return $.root().text().replace(/\s+/g, " ").trim();
}
export function normalizeArticle(
  raw: { title: unknown; url: unknown; content: unknown; publishedAt: unknown },
  source: { id: string; name: string },
  now = new Date(),
  maxAgeHours = 48,
): Article | null {
  try {
    const url = canonicalUrl(String(raw.url));
    const date = new Date(String(raw.publishedAt));
    // A bounded 48-hour collection window tolerates late feeds and quiet weekends.
    if (
      !Number.isFinite(date.getTime()) ||
      date.getTime() > now.getTime() + 300_000 ||
      date.getTime() < now.getTime() - maxAgeHours * 3600_000
    )
      return null;
    const result = articleSchema.safeParse({
      id: createHash("sha256").update(url).digest("hex"),
      sourceId: source.id,
      sourceName: source.name,
      title: plainText(raw.title).slice(0, 350),
      url,
      content: plainText(raw.content).slice(0, 6500),
      publishedAt: date.toISOString(),
    });
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
export function deduplicate(articles: Article[]) {
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
