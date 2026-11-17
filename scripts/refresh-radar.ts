import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { readFile, writeFile } from "node:fs/promises";
import { collectRepositories } from "../src/lib/sources/github";
import { getDb } from "../src/lib/db";
import { briefings } from "../src/lib/db/schema";
import { editionSchema } from "../src/lib/schemas";
config({ path: ".env.local" });
async function main() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const previewOnly = process.argv.includes("--preview");
  if (!previewOnly && !process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required; use --preview to update only the local snapshot.");
  const radar = await collectRepositories(now);
  if (!radar.repositories.length || radar.unavailable || radar.releaseFailures)
    throw new Error("Incomplete GitHub collection; existing snapshot left unchanged.");
  if (previewOnly) {
    const path = new URL("../src/lib/preview.json", import.meta.url);
    const edition = editionSchema.parse(JSON.parse(await readFile(path, "utf8")));
    if (edition.date !== date)
      throw new Error("Refresh the full preview first; its news snapshot is from another date.");
    edition.repositories = radar.repositories;
    edition.outcomes.repositories = radar.repositories.length;
    await writeFile(path, `${JSON.stringify(edition, null, 2)}\n`);
  } else {
    // Explicit maintenance command: replace only today's radar metadata. News stays immutable.
    const db = getDb();
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(briefings)
        .where(and(eq(briefings.date, date), eq(briefings.status, "published")))
        .for("update");
      if (!row?.outcomes) throw new Error("Publish today's briefing before refreshing its radar.");
      await tx
        .update(briefings)
        .set({
          repositories: radar.repositories,
          outcomes: {
            ...row.outcomes,
            repositories: radar.repositories.length,
            releaseFailures: 0,
          },
        })
        .where(eq(briefings.id, row.id));
    });
  }
  console.info(
    JSON.stringify(
      {
        refreshed: date,
        destination: previewOnly ? "local preview" : "configured database",
        repositories: radar.repositories.map(({ name, stars }) => ({ name, stars })),
      },
      null,
      2,
    ),
  );
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Radar refresh failed");
    process.exit(1);
  });
