import { editionIndexSchema } from "@/lib/presentation";
import { describe, expect, it } from "vitest";
import { prepareCandidates } from "@/lib/editorial/prepare";
import { selectArticles } from "@/lib/editorial/selection";
import { evaluateArticles } from "@/lib/editorial/curation";
import {
  applyEvaluations,
  applyExtractions,
  readyToPublish,
  recheckHistory,
} from "@/lib/pipeline/progress";
import { checkpointSchema } from "@/lib/pipeline/checkpoint";
import { editionSchema, newsCollectionSchema } from "@/lib/schemas";
import { runPipeline } from "@/lib/pipeline/run";
import { article, checkpoint, editor, memoryStore, story } from "../support/fixtures";
import { sampleEdition, historicalEdition } from "@/lib/preview";

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
const now = new Date("2026-11-17T08:00:00Z");
describe("domain and persistence boundaries", () => {
  it("prepares the same bounded editorial candidates without mutating source snapshots", () => {
    const items = [
      article("old"),
      article("new", {
        sourceId: "microsoft-research",
        title: "Microsoft releases neural inference SDK",
      }),
    ];
    const collection = freeze({
      articles: [...items, items[1]],
      reports: [{ source: "openai", status: "ok" as const, count: 3, invalid: 1 }],
    });
    const prepared = prepareCandidates(collection, [items[0]]);
    expect(prepared.articles.map((a) => a.id)).toEqual(["new"]);
    expect(prepared.counts).toMatchObject({
      collected: 3,
      duplicates: 1,
      previouslyPublished: 1,
      rejected: 1,
      invalid: 1,
    });
    expect(
      selectArticles(prepared.articles, evaluateArticles(prepared.articles), now).map((a) => a.id),
    ).toEqual(["new"]);
    expect(collection.articles).toHaveLength(3);
  });
  it("transforms checkpoints without mutating saved progress or input evaluations", () => {
    const cp = freeze(checkpoint());
    const evaluations = freeze([
      { id: "a", score: 90, category: "Models" as const, duplicateOf: null, reason: "Relevant" },
    ]);
    const evaluated = applyEvaluations(cp, evaluations, now);
    const extracted = applyExtractions({ ...evaluated, stories: [] }, [
      { status: "fulfilled", value: story() },
      { status: "rejected", reason: new Error("bad source") },
    ]);
    expect(cp.outcomes.summaryFailures).toBe(0);
    expect(extracted.outcomes).toMatchObject({ summaries: 1, summaryFailures: 1 });
    expect(readyToPublish(freeze(extracted)).phase).toBe("publish");
    const rechecked = recheckHistory(cp, [article()]);
    expect(rechecked.phase).toBe("evaluate");
    expect(rechecked.stories).toEqual([]);
    expect(cp.stories).toHaveLength(1);
  });
  it("reads deployed legacy checkpoint shapes and rejects malformed JSON", () => {
    expect(checkpointSchema.parse(checkpoint()).collectedAt).toBeUndefined();
    expect(
      checkpointSchema.safeParse({ ...checkpoint(), outcomes: { selected: "six" } }).success,
    ).toBe(false);
    expect(checkpointSchema.safeParse({ ...checkpoint(), phase: "unknown" }).success).toBe(false);
    expect(newsCollectionSchema.safeParse({ articles: [{ id: 123 }], reports: [] }).success).toBe(
      false,
    );
  });
  it("retains sample and historical content while rejecting invalid public index data", () => {
    expect(editionSchema.parse(sampleEdition)).toEqual(sampleEdition);
    expect(editionSchema.parse(historicalEdition)).toEqual(historicalEdition);
    expect(
      editionIndexSchema.array().safeParse([{ date: "2026-11-17", title: null }]).success,
    ).toBe(false);
  });
  it("preserves the original failure when lease cleanup also fails", async () => {
    const memory = memoryStore();
    const original = new Error("Original processing failure");
    memory.store.recentArticles = async () => {
      throw original;
    };
    memory.store.release = async () => {
      throw new Error("Cleanup failure");
    };
    await expect(
      runPipeline("2026-11-17", {
        store: memory.store,
        editor,
        collect: async () => ({ articles: [article()], reports: [] }),
        radar: async () => ({ repositories: [], unavailable: 0, releaseFailures: 0 }),
      }),
    ).rejects.toBe(original);
  });
});
