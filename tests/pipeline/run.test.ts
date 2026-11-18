import { describe, it, expect, vi } from "vitest";
import { runPipeline } from "@/lib/pipeline/run";
import { validDate } from "@/lib/dates";
import { article, editor, memoryStore } from "../support/fixtures";
import type { Article } from "@/lib/types";

const collection = (articles: Article[] = [article()]) =>
  vi.fn(async () => ({
    articles,
    reports: [{ source: "openai", count: articles.length, invalid: 0, status: "ok" as const }],
  }));
const radar = async () => ({ repositories: [], unavailable: 0, releaseFailures: 0 });
describe("daily pipeline", () => {
  it("publishes once and treats repeated invocations as no-ops", async () => {
    const memory = memoryStore();
    const collect = collection();
    const deps = { store: memory.store, editor, collect, radar };
    expect((await runPipeline("2026-11-16", deps)).status).toBe("published");
    expect((await runPipeline("2026-11-16", deps)).status).toBe("already-published");
    expect(collect).toHaveBeenCalledTimes(1);
    expect(memory.published()?.stories).toHaveLength(1);
  });
  it("does not publish if every source fails or yields no material", async () => {
    const memory = memoryStore();
    await expect(
      runPipeline("2026-11-16", { store: memory.store, editor, collect: collection([]), radar }),
    ).rejects.toThrow();
    expect(memory.published()).toBeNull();
  });
  it("publishes a partial edition when source collection is incomplete", async () => {
    const memory = memoryStore();
    const collect = async () => ({
      articles: [article()],
      reports: [{ source: "arxiv", status: "unavailable" as const, count: 0, invalid: 0 }],
    });
    const result = await runPipeline("2026-11-16", { store: memory.store, editor, collect, radar });
    expect(result.partial).toBe(true);
    expect(result.outcomes?.sourcesUnavailable).toBe(1);
  });
  it("continues without GitHub when its collector fails", async () => {
    const memory = memoryStore();
    const result = await runPipeline("2026-11-16", {
      store: memory.store,
      editor,
      collect: collection(),
      radar: async () => {
        throw new Error("offline");
      },
    });
    expect(result.status).toBe("published");
    expect(result.outcomes?.sourcesUnavailable).toBe(3);
  });
  it("retains collected material and resumes after an editor failure", async () => {
    const memory = memoryStore();
    const collect = collection();
    await expect(
      runPipeline("2026-11-16", {
        store: memory.store,
        editor: {
          ...editor,
          evaluate: async () => {
            throw new Error("provider unavailable");
          },
        },
        collect,
        radar,
      }),
    ).rejects.toThrow();
    expect(memory.checkpoint()?.phase).toBe("evaluate");
    expect(memory.published()).toBeNull();
    const result = await runPipeline("2026-11-16", { store: memory.store, editor, collect, radar });
    expect(result.status).toBe("published");
    expect(collect).toHaveBeenCalledTimes(1);
  });
  it("keeps validated summaries and marks a partly summarized edition as partial", async () => {
    const memory = memoryStore();
    const result = await runPipeline("2026-11-16", {
      store: memory.store,
      editor: {
        ...editor,
        summarize: (a) =>
          a.id === "b" ? Promise.reject(new Error("invalid evidence")) : editor.summarize(a),
      },
      collect: collection([article("a"), article("b")]),
      radar,
    });
    expect(result.status).toBe("published");
    expect(result.partial).toBe(true);
    expect(result.outcomes?.summaryFailures).toBe(1);
    expect(memory.published()?.stories).toHaveLength(1);
  });
  it("never publishes empty content if all summarization calls fail", async () => {
    const memory = memoryStore();
    const collect = collection();
    await expect(
      runPipeline("2026-11-16", {
        store: memory.store,
        editor: {
          ...editor,
          summarize: async () => {
            throw new Error("provider offline");
          },
        },
        collect,
        radar,
      }),
    ).rejects.toThrow();
    expect(memory.checkpoint()?.phase).toBe("summarize");
    expect(memory.published()).toBeNull();
  });
  it("checkpoints and yields before a serverless execution can time out", async () => {
    const memory = memoryStore();
    const collect = collection();
    const first = await runPipeline("2026-11-16", {
      store: memory.store,
      editor,
      collect,
      radar,
      budgetMs: 1000,
    });
    expect(first.status).toBe("pending");
    expect(memory.checkpoint()?.phase).toBe("evaluate");
    expect(
      (await runPipeline("2026-11-16", { store: memory.store, editor, collect, radar })).status,
    ).toBe("published");
    expect(collect).toHaveBeenCalledTimes(1);
  });
  it("avoids work when another invocation owns the lease", async () => {
    const memory = memoryStore();
    const collect = collection();
    await memory.store.claim("2026-11-16", "owner");
    expect(
      (await runPipeline("2026-11-16", { store: memory.store, editor, collect, radar })).status,
    ).toBe("busy");
    expect(collect).not.toHaveBeenCalled();
  });
  it("rejects impossible dates", () => {
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("not-a-date")).toBe(false);
    expect(validDate("2026-11-16")).toBe(true);
  });
});

describe("day-to-day novelty", () => {
  it("filters yesterday before publisher quotas and reports rejected repeats", async () => {
    const memory = memoryStore();
    const old = article("old");
    memory.store.recentArticles = async () => [old];
    const result = await runPipeline("2026-11-17", {
      store: memory.store,
      editor,
      collect: collection([
        old,
        article("fresh", {
          title: "Microsoft releases neural image embeddings",
          sourceId: "microsoft-research",
        }),
      ]),
      radar,
    });
    expect(result.outcomes?.previouslyPublished).toBe(1);
    expect(memory.published()?.stories.map((s) => s.id)).toEqual(["fresh"]);
  });
  it("returns a quiet-day outcome and recollects on a later retry", async () => {
    const memory = memoryStore();
    memory.store.recentArticles = async () => [article()];
    const collect = collection();
    const deps = { store: memory.store, editor, collect, radar };
    expect((await runPipeline("2026-11-17", deps)).status).toBe("no-new-stories");
    expect(memory.published()).toBeNull();
    expect(memory.checkpoint()).toBeNull();
    await runPipeline("2026-11-17", deps);
    expect(collect).toHaveBeenCalledTimes(2);
  });
  it("rechecks a saved checkpoint against newly published history", async () => {
    const memory = memoryStore();
    const collect = collection();
    await runPipeline("2026-11-17", {
      store: memory.store,
      editor,
      collect,
      radar,
      budgetMs: 1000,
    });
    memory.store.recentArticles = async () => [article()];
    expect(
      (await runPipeline("2026-11-17", { store: memory.store, editor, collect, radar })).status,
    ).toBe("no-new-stories");
    expect(memory.published()).toBeNull();
  });
  it("fails closed if history cannot be read", async () => {
    const memory = memoryStore();
    memory.store.recentArticles = async () => {
      throw new Error("database unavailable");
    };
    const collect = collection();
    await expect(
      runPipeline("2026-11-17", { store: memory.store, editor, collect, radar }),
    ).rejects.toThrow();
    expect(collect).not.toHaveBeenCalled();
    expect(memory.published()).toBeNull();
  });
});
