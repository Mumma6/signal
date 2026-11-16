import { describe, it, expect } from "vitest";
import { canonicalUrl, deduplicate, normalizeArticle, plainText } from "@/lib/sources/normalize";
import { parseFeed } from "@/lib/sources/collect";
import { article } from "./fixtures";

describe("source normalization", () => {
  const now = new Date("2026-11-16T06:00:00Z");
  const raw = {
    title: "A new model release",
    url: "https://example.com/news/?utm_source=feed&b=2&a=1#comments",
    content: article().content,
    publishedAt: now.toISOString(),
  };
  it("canonicalizes tracking parameters and fragments without removing meaningful queries", () => {
    expect(canonicalUrl(raw.url)).toBe("https://example.com/news?a=1&b=2");
  });
  it.each([
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://localhost/x",
    "https://127.0.0.1/x",
    "https://user:password@example.com",
  ])("rejects unsafe source links: %s", (url) => {
    expect(() => canonicalUrl(url)).toThrow();
  });
  it("rejects invalid, stale, future, and insufficiently supported stories", () => {
    for (const patch of [
      { publishedAt: "bad" },
      { publishedAt: "2026-11-01" },
      { publishedAt: "2026-12-01" },
      { content: "Only a headline." },
      { url: null },
    ]) {
      expect(
        normalizeArticle({ ...raw, ...patch }, { id: "openai", name: "OpenAI" }, now),
      ).toBeNull();
    }
  });
  it("creates stable identities for equivalent URLs", () => {
    const a = normalizeArticle(raw, { id: "openai", name: "OpenAI" }, now);
    const b = normalizeArticle(
      { ...raw, url: "https://example.com/news?a=1&b=2" },
      { id: "hn", name: "Hacker News" },
      now,
    );
    expect(a?.id).toBe(b?.id);
    expect(a?.url).toBe(b?.url);
  });
  it("removes both URL and normalized-title duplicates", () => {
    expect(
      deduplicate([
        article("a"),
        article("b", { url: article("a").url }),
        article("c", { title: article("a").title.toUpperCase() }),
        article("d"),
      ]),
    ).toHaveLength(2);
  });
  it("strips markup without rendering source HTML", () => {
    expect(plainText("<script>alert(1)</script><b>New &amp; useful</b>")).toBe("New & useful");
  });
  it("reads RSS and Atom singleton entries", () => {
    expect(
      parseFeed("<rss><channel><item><title>News</title></item></channel></rss>", "rss"),
    ).toHaveLength(1);
    expect(
      parseFeed(
        '<feed><entry><title>Paper</title><link href="https://arxiv.org/abs/1"/></entry></feed>',
        "atom",
      ),
    ).toHaveLength(1);
  });
  it("rejects malformed XML and entity declarations", () => {
    expect(() => parseFeed("<rss><channel>", "rss")).toThrow();
    expect(() => parseFeed('<!DOCTYPE foo [<!ENTITY x "boom">]><rss/>', "rss")).toThrow();
  });
});
