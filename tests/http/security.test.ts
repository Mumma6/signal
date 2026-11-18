import { describe, it, expect } from "vitest";
import { authorizedCron } from "@/lib/http/cron";
import { editionFeed } from "@/lib/http/feed";
import { sampleEdition } from "@/lib/preview";
describe("security and isolation", () => {
  it("fails closed when cron authorization is missing, short or incorrect", () => {
    const secret = "a".repeat(64);
    expect(authorizedCron(null, secret)).toBe(false);
    expect(authorizedCron("Bearer undefined", undefined)).toBe(false);
    expect(authorizedCron("Bearer short", "short")).toBe(false);
    expect(authorizedCron(`Bearer ${"b".repeat(64)}`, secret)).toBe(false);
    expect(authorizedCron(`Bearer ${secret}`, secret)).toBe(true);
  });
  it("escapes untrusted source text in RSS and labels historical examples", () => {
    const edition = structuredClone(sampleEdition);
    edition.stories[0].summary = '<script>alert("x")</script> & text';
    const feed = editionFeed(edition, "https://signal.example");
    expect(feed).not.toContain("<script>");
    expect(feed).toContain("&lt;script&gt;");
    expect(feed).toContain(
      edition.sampleKind === "source-snapshot" ? "[Source snapshot]" : "[Historical sample]",
    );
    expect(feed).toContain("https://signal.example/feed.xml");
  });
});
