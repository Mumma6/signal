import { config } from "dotenv";
config({ path: ".env.local" });
async function main() {
  const { collectArticles } = await import("../../src/lib/sources/collect");
  const { collectRepositories } = await import("../../src/lib/sources/github");
  const [news, radar] = await Promise.all([collectArticles(), collectRepositories()]);
  console.info(
    JSON.stringify(
      {
        reports: news.reports,
        usableArticles: news.articles.length,
        repositories: radar.repositories.length,
        unavailableRepositories: radar.unavailable,
        releaseFailures: radar.releaseFailures,
      },
      null,
      2,
    ),
  );
  if (!news.articles.length) process.exitCode = 1;
}
main().catch(() => {
  console.error("Source checks failed");
  process.exitCode = 1;
});
