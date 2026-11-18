import { SourceHttpError } from "@/lib/sources/http";
import { describe, expect, it } from "vitest";
import {
  collectRepositories,
  eligibleRepository,
  githubRepoSchema,
  radarSearchUrl,
  selectRepositories,
  type GitHubRepo,
} from "@/lib/sources/github";
const now = new Date("2026-11-16T06:00:00Z");
const repo = (name: string, patch: Partial<GitHubRepo> = {}): GitHubRepo => ({
  full_name: name,
  html_url: `https://github.com/${name}`,
  description: "An open inference framework with a developer SDK and evaluation tools.",
  stargazers_count: 1500,
  language: "Python",
  created_at: "2026-11-10T00:00:00Z",
  pushed_at: "2026-11-15T00:00:00Z",
  archived: false,
  disabled: false,
  fork: false,
  private: false,
  is_template: false,
  mirror_url: null,
  size: 100,
  topics: ["llm"],
  license: { spdx_id: "MIT" },
  ...patch,
});
describe("popular and active GitHub discovery", () => {
  it("requires popularity and recent activity without excluding established projects", () => {
    const url = new URL(radarSearchUrl("llm", now));
    expect(url.searchParams.get("q")).not.toContain("created:");
    expect(url.searchParams.get("q")).toContain("pushed:>=2026-11-02");
    expect(url.searchParams.get("sort")).toBe("updated");
    expect(url.searchParams.get("q")).toContain("stars:>=1000");
  });
  it("rejects unpopular, stale, unlicensed, archived, forked and persona-only repositories", () => {
    for (const patch of [
      { stargazers_count: 999 },
      { stargazers_count: 0 },
      { pushed_at: "2026-10-01T00:00:00Z" },
      { license: null },
      { archived: true },
      { fork: true },
      { is_template: true },
      { description: "A fictional queen and her collection of memorable game character lines." },
    ])
      expect(eligibleRepository(repo("a/tool", patch), now)).toBe(false);
    expect(eligibleRepository(repo("a/tool"), now)).toBe(true);
    expect(
      eligibleRepository(
        repo("a/tool", { created_at: "2024-01-01T00:00:00Z", stargazers_count: 1000 }),
        now,
      ),
    ).toBe(true);
  });
  it("orders popular projects by activity and diversifies owners", () => {
    const candidates = [
      {
        repo: repo("a/old", { stargazers_count: 100000, pushed_at: "2026-11-14T00:00:00Z" }),
        topic: "llm",
      },
      { repo: repo("b/new", { pushed_at: "2026-11-15T00:00:00Z" }), topic: "llm" },
      { repo: repo("b/other"), topic: "ai-agents" },
    ];
    const selected = selectRepositories(candidates, now);
    expect(selected[0].repo.full_name).toBe("b/new");
    expect(selected.filter((c) => c.repo.full_name.startsWith("b/"))).toHaveLength(1);
  });
  it("refuses unexpected hosts and unsafe repository names", () => {
    expect(
      githubRepoSchema.safeParse(repo("a/tool", { html_url: "https://evil.example" })).success,
    ).toBe(false);
    expect(githubRepoSchema.safeParse(repo("../evil/tool")).success).toBe(false);
  });
  it("treats a missing release as a normal outcome and continues after a failed search", async () => {
    let calls = 0;
    const result = await collectRepositories(now, async (url) => {
      calls++;
      if (url.includes("/releases/latest")) throw new SourceHttpError(404);
      if (url.includes("topic%3Aai-agents")) throw new Error("rate limited");
      return JSON.stringify({
        incomplete_results: false,
        items: [repo(url.includes("machine-learning") ? "ml/new" : "llm/new")],
      });
    });
    expect(result.unavailable).toBe(1);
    expect(result.releaseFailures).toBe(0);
    expect(result.repositories).toHaveLength(2);
    expect(calls).toBeLessThanOrEqual(9);
    expect(result.repositories[0].createdAt).toBeDefined();
  });
  it("reports an empty but successful search without fabricating recommendations", async () => {
    const result = await collectRepositories(now, async () =>
      JSON.stringify({ incomplete_results: false, items: [] }),
    );
    expect(result.repositories).toEqual([]);
    expect(result.unavailable).toBe(0);
  });
});
