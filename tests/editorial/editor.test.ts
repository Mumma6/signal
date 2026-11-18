import { describe, it, expect } from "vitest";
import { selectArticles } from "@/lib/editorial/selection";
import { summarySchema, validateEvaluations, validateGrounding } from "@/lib/editorial/editor";
import { article, editor, story } from "../support/fixtures";
import { checkpoint } from "../support/fixtures";
import { isPartial } from "@/lib/editorial/copy";
import { sampleEdition } from "@/lib/preview";

describe("editorial checks", () => {
  it("does not label a recovered edition partial just because an earlier AI attempt failed", () => {
    const cp = checkpoint();
    cp.repositories = sampleEdition.repositories;
    cp.outcomes.summaryFailures = 2;
    expect(isPartial(cp)).toBe(false);
    cp.selected.push({ ...article("b"), category: "Models" });
    expect(isPartial(cp)).toBe(true);
  });
  it("selects relevant canonical articles in stable score order", async () => {
    const items = [article("a"), article("b"), article("c")];
    const evaluations = await editor.evaluate(items);
    evaluations[0].score = 40;
    evaluations[2].duplicateOf = "b";
    expect(selectArticles(items, evaluations).map((a) => a.id)).toEqual(["b"]);
  });
  it("rejects unknown IDs, duplicate evaluations, and missing evaluations", async () => {
    const items = [article()];
    const [evaluation] = await editor.evaluate(items);
    expect(() => validateEvaluations(items, [{ ...evaluation, id: "invented" }])).toThrow();
    expect(() => validateEvaluations(items, [evaluation, evaluation])).toThrow();
    expect(() => validateEvaluations(items, [])).toThrow();
  });
  it("rejects circular duplicate groups", async () => {
    const items = [article("a"), article("b")];
    const evaluations = await editor.evaluate(items);
    evaluations[0].duplicateOf = "b";
    evaluations[1].duplicateOf = "a";
    expect(() => validateEvaluations(items, evaluations)).toThrow();
  });
  it("accepts source-grounded evidence", () => {
    expect(validateGrounding(article(), story()).summary).toBe(story().summary);
  });
  it("rejects invented evidence, numbers and quotations", () => {
    expect(() =>
      validateGrounding(article(), {
        ...story(),
        evidence: ["An invented quote not in the source."],
      }),
    ).toThrow();
    expect(() =>
      validateGrounding(article(), { ...story(), summary: "The model is 92% faster." }),
    ).toThrow();
    expect(() =>
      validateGrounding(article(), { ...story(), summary: 'The team said "world leading".' }),
    ).toThrow();
  });
  it("limits evidence excerpts and summary lengths at runtime", () => {
    expect(summarySchema.safeParse({ ...story(), summary: "x".repeat(551) }).success).toBe(false);
    expect(
      summarySchema.safeParse({ ...story(), evidence: [Array(27).fill("word").join(" ")] }).success,
    ).toBe(false);
  });
});

describe("freshness and diversity", () => {
  const now = new Date("2026-11-17T08:00:00Z");
  it("prefers the newer development when relevance scores are equal", async () => {
    const items = [
      article("a-old", { publishedAt: "2026-11-15T09:00:00Z" }),
      article("z-new", { publishedAt: "2026-11-17T07:00:00Z" }),
    ];
    expect(selectArticles(items, await editor.evaluate(items), now)[0].id).toBe("z-new");
  });
  it("balances strong independent publishers before a second vendor post", async () => {
    const items = [
      article("vendor-a"),
      article("vendor-b"),
      article("independent", { sourceId: "simon-willison" }),
      article("research", { sourceId: "microsoft-research" }),
    ];
    const chosen = selectArticles(items, await editor.evaluate(items), now);
    expect(new Set(chosen.slice(0, 3).map((a) => a.sourceId)).size).toBe(3);
  });
  it("publishes fewer stories rather than padding with below-threshold candidates", async () => {
    const items = [article("good"), article("weak")];
    const evaluations = await editor.evaluate(items);
    evaluations[1].score = 59;
    expect(selectArticles(items, evaluations, now).map((a) => a.id)).toEqual(["good"]);
  });
});
