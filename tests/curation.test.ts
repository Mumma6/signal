import { describe, expect, it, vi } from "vitest";
import { createEditor } from "@/lib/pipeline/editor";
import { evaluateArticles, sameDevelopment, scoreArticle } from "@/lib/editorial/curation";
import { discoverThemes } from "@/lib/editorial/themes";
import { balanceCandidates } from "@/lib/editorial/balance";
import { mapSettled } from "@/lib/concurrency";
import { article } from "./fixtures";

describe("provider-free curation", () => {
  it("evaluates and extracts without credentials or network calls", async () => {
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network forbidden"));
    try {
      const editor = createEditor();
      const [evaluation] = await editor.evaluate([article()]);
      const story = await editor.summarize({ ...article(), category: evaluation.category });
      expect(story.summaryKind).toBe("source-excerpt");
      expect(article().content).toContain(story.summary);
      expect(story.summary.split(/\s+/).length).toBeLessThanOrEqual(25);
      expect(network).not.toHaveBeenCalled();
    } finally {
      network.mockRestore();
    }
  });
  it("rejects unrelated material even when an incidental AI mention appears in the body", () => {
    expect(
      scoreArticle(
        article("x", {
          sourceId: "simon-willison",
          title: "A new geospatial map plugin",
          content:
            "This plugin renders maps with an open library. An AI assistant helped with the release. It supports several geographic projections and custom layers.",
        }),
      ),
    ).toBeLessThan(60);
  });
  it("groups close headlines but preserves distinct software versions", () => {
    expect(
      sameDevelopment(
        article("a", { title: "OpenAI releases Codex terminal workflow support" }),
        article("b", { title: "Codex terminal workflow support released by OpenAI" }),
      ),
    ).toBe(true);
    expect(
      sameDevelopment(
        article("a", { title: "Codex releases terminal support in 1.2.0" }),
        article("b", { title: "Codex releases terminal support in 1.3.0" }),
      ),
    ).toBe(false);
  });
  it("gives a publisher one quota across several official feeds", () => {
    const items = [
      ...Array.from({ length: 10 }, (_, i) =>
        article(`google-${i}`, { sourceId: i % 2 ? "gemini" : "deepmind" }),
      ),
      article("community", { sourceId: "devto" }),
    ];
    const selected = balanceCandidates(items);
    expect(selected.filter((a) => a.sourceId !== "devto")).toHaveLength(4);
    expect(selected.some((a) => a.id === "community")).toBe(true);
  });
  it("finds recurring phrases without hardcoding a topic", () => {
    const items = [
      article("a", {
        sourceId: "devto",
        title: "Software factories reshape agentic engineering workflows",
        content:
          "Software factories combine agentic workflows and validation. Developers use AI agents and a framework to implement software with repeatable evaluation and review.",
      }),
      article("b", {
        sourceId: "simon-willison",
        title: "Why software factories need human review",
        content:
          "Software factories coordinate AI agents to write software. A new framework adds validation and a review API around the development workflow and generated changes.",
      }),
    ];
    const themes = discoverThemes(items, evaluateArticles(items));
    expect(themes.some((t) => t.title.toLowerCase() === "software factories")).toBe(true);
    expect(themes[0].publisherCount).toBe(2);
    expect(themes[0].sources).toHaveLength(2);
  });
  it("does not treat multiple feeds from one company as independent evidence", () => {
    const items = [
      article("a", {
        sourceId: "gemini",
        title: "Gemini introduces agentic engineering workflows",
      }),
      article("b", { sourceId: "deepmind", title: "Research into agentic engineering workflows" }),
    ];
    expect(discoverThemes(items, evaluateArticles(items))).toEqual([]);
  });
  it("does not produce themes from duplicate coverage of one development", () => {
    const items = [
      article("a", { sourceId: "devto", title: "OpenAI releases Codex terminal workflow support" }),
      article("b", {
        sourceId: "openai",
        title: "Codex terminal workflow support released by OpenAI",
      }),
    ];
    expect(discoverThemes(items, evaluateArticles(items))).toEqual([]);
  });
  it("bounds concurrency and preserves successful results when a worker fails", async () => {
    let active = 0;
    let peak = 0;
    const results = await mapSettled([1, 2, 3, 4, 5], 2, async (value) => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      if (value === 3) throw new Error("offline");
      return value * 2;
    });
    expect(peak).toBeLessThanOrEqual(2);
    expect(results[2].status).toBe("rejected");
    expect(results[4]).toEqual({ status: "fulfilled", value: 10 });
  });
});

describe("editorial priorities", () => {
  it("puts concrete releases ahead of keyword-heavy customer marketing", () => {
    const customer = article("customer", {
      sourceId: "aws-ml",
      title: "How MoEngage built agentic customer engagement on Amazon Bedrock AgentCore",
      content:
        "AI agents use inference, APIs, SDKs, reasoning, neural models and frameworks. ".repeat(25),
    });
    const launch = article("launch", { title: "OpenAI releases a new reasoning model and API" });
    expect(scoreArticle(customer)).toBeLessThan(60);
    expect(scoreArticle(launch)).toBeGreaterThan(scoreArticle(customer));
    expect(
      scoreArticle(
        article("partnership", { title: "OpenAI announces strategic partnership with Example" }),
      ),
    ).toBeLessThan(60);
  });
  it("does not discard stronger older candidates before evaluation", () => {
    const weak = Array.from({ length: 5 }, (_, i) =>
      article(`weak-${i}`, {
        sourceId: "aws-ml",
        title: `How Company ${i} uses AI for customer engagement`,
        publishedAt: "2026-11-17T07:00:00Z",
      }),
    );
    const launch = article("strong", {
      sourceId: "aws-ml",
      title: "Introducing a new agent inference API",
      publishedAt: "2026-11-16T12:00:00Z",
    });
    expect(balanceCandidates([...weak, launch]).some((a) => a.id === "strong")).toBe(true);
  });
});
