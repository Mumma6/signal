import { describe, expect, it } from "vitest";
import { collectArticles, parseSource, parseFeed } from "@/lib/sources/collect";
import { parseAnthropic, parseXaiNotes } from "@/lib/sources/pages";
import { sourceDefinitions } from "@/lib/sources/registry";

describe("expanded news sources", () => {
  it("accepts HTML doctypes inside feed CDATA without allowing XML DTDs", () => {
    const xml =
      "<rss><channel><item><title>News</title><description><![CDATA[<!DOCTYPE html><html><body>A source excerpt.</body></html>]]></description></item></channel></rss>";
    expect(parseFeed(xml, "rss")).toHaveLength(1);
    expect(() =>
      parseFeed('<!DOCTYPE rss [<!ENTITY x "bad">]><rss><channel/></rss>', "rss"),
    ).toThrow();
  });
  it("uses older recent material for themes while keeping it off the daily news cards", async () => {
    const definitions = sourceDefinitions.filter((s) => s.id === "openai");
    const result = await collectArticles(
      new Date("2026-11-16T06:00:00Z"),
      async () =>
        `<rss><channel><item><title>New AI workflow research</title><link>https://openai.com/older-test</link><pubDate>Thu, 12 Nov 2026 05:00:00 GMT</pubDate><description>${"Original source material about AI agents and software engineering workflows. ".repeat(3)}</description></item></channel></rss>`,
      definitions,
    );
    expect(result.articles).toHaveLength(0);
    expect(result.contextArticles).toHaveLength(1);
  });
  it("includes the requested providers and community blogs", () => {
    expect(sourceDefinitions.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        "openai",
        "codex",
        "anthropic",
        "claude-code",
        "cursor",
        "xai",
        "mistral",
        "gemini",
        "deepmind",
        "devto",
        "simon-willison",
      ]),
    );
  });
  it("extracts Atom HTML content and skips CLI prereleases", () => {
    const source = sourceDefinitions.find((s) => s.id === "codex")!;
    const xml =
      '<feed><entry><title>v1.2.0-alpha.1</title><content type="html">&lt;p&gt;Alpha&lt;/p&gt;</content></entry><entry><title>v1.2.0</title><content type="html">&lt;p&gt;Stable release content&lt;/p&gt;</content><published>2026-11-16T05:00:00Z</published><link href="https://github.com/openai/codex/releases/tag/v1.2.0" rel="alternate"/></entry></feed>';
    const items = parseSource(xml, source);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe("<p>Stable release content</p>");
  });
  it("accepts negotiated Atom at a feed declared RSS and rejects HTML pretending to be a feed", () => {
    expect(parseFeed("<feed><entry><title>News</title></entry></feed>", "rss")).toHaveLength(1);
    expect(() => parseFeed("<html><body>Not a feed</body></html>", "rss")).toThrow();
  });
  it("extracts only locally dated Anthropic cards", () => {
    const rows = parseAnthropic(
      '<main><h1>News</h1><time>November 16, 2026</time><article><header><time>Nov 12, 2026</time></header><a href="/news/new-claude"><h2>New Claude developer tools</h2><p>A dated original source description with enough context to understand the announced update.</p></a></article><article><a href="/news/undated"><h2>Undated news</h2><p>A story without its own date must not borrow the page date.</p></a></article></main>',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].publishedAt).toBe("2026-11-12T00:00:00.000Z");
  });
  it("anchors yearless xAI months to an explicit year in the document", () => {
    const rows = parseXaiNotes(
      '<main><span><h2>January</h2></span><div><div>January 3</div><div><span><h3 id="grok-new">New Grok tools</h3></span><p>Grok gains new developer tools with original release notes and API details.</p></div></div><span><h2>December 2025</h2></span></main>',
    );
    expect(rows[0].publishedAt).toBe("2026-01-03T00:00:00.000Z");
    expect(rows[0].url).toContain("?section=grok-new");
  });
  it("fails visibly when an official page changes to unrecognized markup", () => {
    expect(() => parseAnthropic("<main>Page changed</main>")).toThrow();
    expect(() => parseXaiNotes('<h3 id="new">Undated release</h3>')).toThrow();
  });
  it("retains other feeds when one upstream is unavailable", async () => {
    const definitions = sourceDefinitions.filter((s) => ["openai", "huggingface"].includes(s.id));
    const result = await collectArticles(
      new Date("2026-11-16T06:00:00Z"),
      async (url) => {
        if (url.includes("huggingface")) throw new Error("offline");
        return `<rss><channel><item><title>A new AI model release</title><link>https://openai.com/test</link><pubDate>Mon, 16 Nov 2026 05:00:00 GMT</pubDate><description>${"Original source material about a new AI model and useful developer tools. ".repeat(3)}</description></item></channel></rss>`;
      },
      definitions,
    );
    expect(result.articles).toHaveLength(1);
    expect(result.reports.find((r) => r.source === "huggingface")?.status).toBe("unavailable");
  });
});
