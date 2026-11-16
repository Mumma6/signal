import { z } from "zod";
import type { Repository } from "@/lib/types";
import { fetchText } from "./http";
import { observe } from "@/lib/observability";
import { mapSettled } from "@/lib/concurrency";

export const radarTopics = ["llm", "ai-agents", "machine-learning"] as const;
export const radarLimit = 6;
const day = 86400000;
const nameSchema = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
export const githubRepoSchema = z
  .object({
    full_name: nameSchema,
    description: z.string().nullable(),
    html_url: z.url(),
    stargazers_count: z.number().int().nonnegative(),
    language: z.string().nullable(),
    created_at: z.iso.datetime(),
    pushed_at: z.iso.datetime().nullable(),
    archived: z.boolean(),
    disabled: z.boolean(),
    fork: z.boolean(),
    private: z.boolean(),
    is_template: z.boolean().optional().default(false),
    mirror_url: z.string().nullable().optional().default(null),
    size: z.number().nonnegative(),
    topics: z.array(z.string()).default([]),
    license: z.object({ spdx_id: z.string() }).nullable(),
  })
  .refine(
    (repo) => repo.html_url === `https://github.com/${repo.full_name}`,
    "Unexpected GitHub repository URL",
  );
export type GitHubRepo = z.infer<typeof githubRepoSchema>;
const searchSchema = z.object({
  incomplete_results: z.boolean(),
  items: z.array(z.unknown()).max(30),
});
const releaseSchema = z.object({
  tag_name: z.string().min(1).max(120),
  html_url: z.url(),
  published_at: z.iso.datetime(),
  draft: z.boolean(),
  prerelease: z.boolean(),
});

export function radarSearchUrl(topic: string, now: Date) {
  const date = (age: number) => new Date(now.getTime() - age * day).toISOString().slice(0, 10);
  const query = `topic:${topic} created:>=${date(90)} pushed:>=${date(14)} archived:false fork:false is:public size:>10`;
  return `https://api.github.com/search/repositories?${new URLSearchParams({ q: query, sort: "updated", order: "desc", per_page: "10" })}`;
}
export function eligibleRepository(repo: GitHubRepo, now: Date) {
  const created = Date.parse(repo.created_at);
  const pushed = Date.parse(repo.pushed_at ?? "");
  return (
    !repo.archived &&
    !repo.disabled &&
    !repo.fork &&
    !repo.private &&
    !repo.is_template &&
    !repo.mirror_url &&
    !!repo.license &&
    !["NOASSERTION", "NONE"].includes(repo.license.spdx_id) &&
    repo.size > 10 &&
    !!repo.language &&
    (repo.description?.trim().length ?? 0) >= 35 &&
    /\b(?:inference|fine.tun\w*|train\w*|evaluat\w*|embedding\w*|retrieval|RAG|MCP|SDK|API|server|framework|library|harness|workflow\w*|benchmark\w*|dataset\w*|gradient|bayesian|optimization|agentic)\b/i.test(
      repo.description ?? "",
    ) &&
    created <= now.getTime() &&
    created >= now.getTime() - 90 * day &&
    pushed <= now.getTime() + 300000 &&
    pushed >= now.getTime() - 14 * day &&
    !/(?:^|[-_])(?:awesome|collection|prompts|courses?|tutorials?|roadmap|list)(?:$|[-_])/i.test(
      repo.full_name.split("/")[1],
    )
  );
}

export function selectRepositories(candidates: { repo: GitHubRepo; topic: string }[], now: Date) {
  const unique = new Map<string, { repo: GitHubRepo; topic: string }>();
  for (const candidate of candidates)
    if (
      eligibleRepository(candidate.repo, now) &&
      !unique.has(candidate.repo.full_name.toLowerCase())
    )
      unique.set(candidate.repo.full_name.toLowerCase(), candidate);
  const groups = radarTopics.map((topic) =>
    [...unique.values()]
      .filter((c) => c.topic === topic)
      .sort(
        (a, b) =>
          b.repo.created_at.localeCompare(a.repo.created_at) ||
          a.repo.full_name.localeCompare(b.repo.full_name),
      ),
  );
  const selected: { repo: GitHubRepo; topic: string }[] = [];
  const owners = new Set<string>();
  for (let round = 0; round < 2; round++)
    for (const group of groups) {
      const next = group.find((c) => !owners.has(c.repo.full_name.split("/")[0].toLowerCase()));
      if (next) {
        selected.push(next);
        owners.add(next.repo.full_name.split("/")[0].toLowerCase());
      }
    }
  return selected.slice(0, radarLimit);
}

export async function collectRepositories(now = new Date(), read: typeof fetchText = fetchText) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  // Three sequential searches stay comfortably inside the separate search quota.
  const searches = await mapSettled(radarTopics, 1, (topic) =>
    observe(
      "github.discovery",
      async () => {
        const result = searchSchema.parse(
          JSON.parse(await read(radarSearchUrl(topic, now), headers)),
        );
        return {
          incomplete: result.incomplete_results,
          candidates: result.items.flatMap((item) => {
            const parsed = githubRepoSchema.safeParse(item);
            return parsed.success ? [{ repo: parsed.data, topic }] : [];
          }),
        };
      },
      (result) => ({ topic, discovered: result.candidates.length, incomplete: result.incomplete }),
    ),
  );
  const candidates = searches.flatMap((result) =>
    result.status === "fulfilled" ? result.value.candidates : [],
  );
  const selected = selectRepositories(candidates, now);
  let releaseFailures = 0;
  const releases = await mapSettled(selected, 3, ({ repo, topic }) =>
    observe(
      "github.release_collection",
      async () => {
        let release: z.infer<typeof releaseSchema> | null = null;
        try {
          const result = releaseSchema.parse(
            JSON.parse(
              await read(`https://api.github.com/repos/${repo.full_name}/releases/latest`, headers),
            ),
          );
          if (
            result.draft ||
            result.prerelease ||
            !result.html_url.startsWith(`https://github.com/${repo.full_name}/releases/`)
          )
            throw new Error("Invalid stable release");
          release = result;
        } catch (error) {
          if (!(error instanceof Error && error.message === "Source returned HTTP 404"))
            releaseFailures++;
        }
        return {
          name: repo.full_name,
          description: repo.description!,
          url: repo.html_url,
          stars: repo.stargazers_count,
          language: repo.language,
          pushedAt: repo.pushed_at,
          createdAt: repo.created_at,
          license: repo.license!.spdx_id,
          discoveryTopic: topic,
          release: release?.tag_name ?? null,
          releaseUrl: release?.html_url ?? null,
          releasePublishedAt: release?.published_at ?? null,
          reason: `Discovered in ${topic}: created within the last 90 days, pushed within 14 days, with a declared ${repo.license!.spdx_id} license.`,
          collectedAt: now.toISOString(),
        } satisfies Repository;
      },
      (result) => ({ repository: result.name, releaseAvailable: result.release !== null }),
    ),
  );
  return {
    repositories: releases.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    ),
    unavailable:
      searches.filter((r) => r.status === "rejected" || r.value.incomplete).length +
      releases.filter((r) => r.status === "rejected").length,
    releaseFailures,
  };
}
