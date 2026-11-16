import { config } from "dotenv";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { collectArticles } from "../src/lib/sources/collect";
import { collectRepositories } from "../src/lib/sources/github";
import { balanceCandidates } from "../src/lib/sources/balance";
import { deduplicate } from "../src/lib/sources/normalize";
import { createEditor, selectArticles } from "../src/lib/pipeline/editor";
import { discoverThemes } from "../src/lib/pipeline/themes";
import { evaluateArticles } from "../src/lib/pipeline/curation";
import { editionCopy } from "../src/lib/pipeline/copy";
import type { Edition } from "../src/lib/types";
config({ path: ".env.local" });
async function main() {
  const now = new Date();
  const [news, radar] = await Promise.all([collectArticles(now), collectRepositories(now)]);
  const unique = deduplicate(news.articles);
  const articles = balanceCandidates(unique);
  const editor = createEditor();
  const evaluations = await editor.evaluate(articles);
  const themeCandidates = balanceCandidates(deduplicate(news.contextArticles), 60);
  const selected = selectArticles(articles, evaluations);
  const results = await Promise.allSettled(selected.map((a) => editor.summarize(a)));
  const stories = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (!stories.length) throw new Error("No readable stories; existing snapshot left unchanged.");
  const edition: Edition = {
    id: `preview-${now.toISOString().slice(0, 10)}`,
    date: now.toISOString().slice(0, 10),
    ...editionCopy(stories),
    stories,
    repositories: radar.repositories,
    themes: discoverThemes(themeCandidates, evaluateArticles(themeCandidates)),
    reports: news.reports,
    sample: true,
    sampleKind: "source-snapshot",
    publishedAt: now.toISOString(),
    partial:
      news.reports.some((r) => r.status === "unavailable") ||
      radar.unavailable > 0 ||
      radar.releaseFailures > 0 ||
      stories.length < selected.length,
    outcomes: {
      collected: news.articles.length,
      duplicates: news.articles.length - unique.length,
      invalid: news.reports.reduce((n, r) => n + r.invalid, 0),
      evaluated: evaluations.length,
      selected: selected.length,
      rejected: unique.length - selected.length,
      summaries: stories.length,
      sourcesUnavailable:
        news.reports.filter((r) => r.status === "unavailable").length + radar.unavailable,
      repositories: radar.repositories.length,
      releaseFailures: radar.releaseFailures,
      summaryFailures: selected.length - stories.length,
    },
  };
  await writeFile(
    fileURLToPath(new URL("../src/lib/preview.json", import.meta.url)),
    `${JSON.stringify(edition, null, 2)}\n`,
  );
  console.info(
    JSON.stringify(
      {
        savedSnapshot: edition.date,
        articles: stories.length,
        themes: edition.themes?.length,
        repositories: radar.repositories.map((r) => r.name),
        partial: edition.partial,
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Snapshot failed");
  process.exitCode = 1;
});
