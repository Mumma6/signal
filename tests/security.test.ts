import { describe, it, expect } from "vitest";
import { authorizedCron } from "@/lib/cron";
import { observe } from "@/lib/observability";
import { editionFeed } from "@/lib/feed";
import { sampleEdition } from "@/lib/sample";
describe("security and isolation", () => {
  it("fails closed when cron authorization is missing, short or incorrect", () => {
    const secret = "a".repeat(64);
    expect(authorizedCron(null, secret)).toBe(false);
    expect(authorizedCron("Bearer undefined", undefined)).toBe(false);
    expect(authorizedCron("Bearer short", "short")).toBe(false);
    expect(authorizedCron(`Bearer ${"b".repeat(64)}`, secret)).toBe(false);
    expect(authorizedCron(`Bearer ${secret}`, secret)).toBe(true);
  });
  it("telemetry failures never affect successful business work", async () => {
    expect(
      await observe(
        "test",
        async () => 42,
        () => ({ selected: 0 }),
        () => {
          throw new Error("sink down");
        },
      ),
    ).toBe(42);
  });
  it("preserves original application errors when telemetry also fails", async () => {
    await expect(
      observe(
        "test",
        async () => {
          throw new Error("original");
        },
        undefined,
        () => {
          throw new Error("sink down");
        },
      ),
    ).rejects.toThrow("original");
  });
  it("isolates asynchronous sink failures and outcome serialization errors", async () => {
    expect(
      await observe(
        "test",
        async () => 42,
        undefined,
        async () => {
          throw new Error("offline");
        },
      ),
    ).toBe(42);
    expect(
      await observe(
        "test",
        async () => 42,
        () => {
          throw new Error("bad metrics");
        },
      ),
    ).toBe(42);
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
