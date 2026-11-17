import { prepareCandidates } from "../src/lib/editorial/prepare";
import { config } from "dotenv";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { newsCollectionSchema } from "../src/lib/schemas";
import { getDb } from "../src/lib/db";
import { briefings, briefingArticles } from "../src/lib/db/schema";
import { createStore } from "../src/lib/db/briefing-store";
import { createEditor } from "../src/lib/editorial/editor";
import { selectArticles } from "../src/lib/editorial/selection";
import { reviseToday } from "../src/lib/db/revise";
import type { Checkpoint } from "../src/lib/pipeline/types";
config({ path: ".env.local" });
async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const input = process.argv[2];
  if (!input)
    throw new Error(
      "Supply a reviewed collector JSON file. Defaults to dry run; add --apply and --backup=/absolute/path.json to revise today's edition.",
    );
  const apply = process.argv.includes("--apply");
  const backupArg = process.argv.find((a) => a.startsWith("--backup="))?.slice(9);
  const expectedArg = process.argv
    .find((a) => a.startsWith("--expected-published-at="))
    ?.split("=")[1];
  if (apply && !backupArg) throw new Error("An explicit local backup path is required for --apply");
  if (apply && !expectedArg)
    throw new Error("Pass --expected-published-at from the reviewed dry run");
  const collection = newsCollectionSchema.parse(JSON.parse(await readFile(input, "utf8")));
  const now = new Date();
  if (
    collection.articles.some(
      (a) =>
        Date.parse(a.publishedAt) < now.getTime() - 48 * 3600000 ||
        Date.parse(a.publishedAt) > now.getTime() + 300000,
    )
  )
    throw new Error("Candidate snapshot is stale or future-dated; collect again");
  const db = getDb();
  const [edition] = await db
    .select()
    .from(briefings)
    .where(and(eq(briefings.date, date), eq(briefings.status, "published")));
  if (!edition?.publishedAt || !edition.outcomes)
    throw new Error("Today's published edition was not found");
  if (apply && edition.publishedAt.toISOString() !== expectedArg)
    throw new Error("Edition changed since the reviewed dry run; revision canceled");
  const before = await db
    .select()
    .from(briefingArticles)
    .where(eq(briefingArticles.briefingId, edition.id));
  const history = await createStore(db).recentArticles(date);
  const prepared = prepareCandidates(collection, history);
  const candidates = prepared.articles;
  const editor = createEditor();
  const evaluations = await editor.evaluate(candidates);
  const selected = selectArticles(candidates, evaluations, now);
  const stories = await Promise.all(selected.map((a) => editor.summarize(a)));
  if (!stories.length)
    throw new Error("No qualified unseen stories; existing edition left unchanged");
  const draft: Checkpoint = {
    phase: "publish",
    collectedAt: now.toISOString(),
    articles: candidates,
    selected,
    stories,
    repositories: edition.repositories,
    reports: collection.reports,
    themes: prepared.themes,
    outcomes: {
      ...edition.outcomes,
      ...prepared.counts,
      evaluated: evaluations.length,
      selected: selected.length,
      rejected: prepared.counts.rejected + evaluations.length - selected.length,
      summaries: stories.length,
      summaryFailures: 0,
      sourcesUnavailable: collection.reports.filter((r) => r.status === "unavailable").length,
    },
  };
  const review = {
    date,
    reviewedPublishedAt: edition.publishedAt.toISOString(),
    mode: apply ? "apply" : "dry-run",
    previouslyPublished: draft.outcomes.previouslyPublished,
    previous: before.map((s) => s.sourceSnapshot.title),
    replacement: stories.map((s) => ({ title: s.title, source: s.sourceName, url: s.url })),
  };
  console.info(JSON.stringify(review, null, 2));
  if (apply) {
    await writeFile(resolve(backupArg!), JSON.stringify({ edition, stories: before }, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    await reviseToday(date, edition.publishedAt, draft, db);
    console.info(
      "Revised today's edition atomically. Historical editions and the GitHub snapshot were preserved.",
    );
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Revision failed");
    process.exit(1);
  });
