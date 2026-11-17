import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { createEditionReader } from "@/lib/db/edition-reader";
import { createStore } from "@/lib/db/briefing-store";
import type { getDb } from "@/lib/db";
import { article, checkpoint, story } from "./fixtures";
import { reviseToday } from "@/lib/db/revise";
import { runPipeline } from "@/lib/pipeline/run";
import { createEditor } from "@/lib/editorial/editor";

describe("PostgreSQL publication contract", () => {
  const pg = new PGlite();
  const db = drizzle(pg, { schema });
  // Both adapters execute the same Drizzle PostgreSQL queries. Only driver metadata differs.
  const testDb = db as unknown as ReturnType<typeof getDb>;
  const store = createStore(testDb);
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
  }, 30000);
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE briefing_articles, articles, briefings, sources CASCADE`);
  });
  afterAll(async () => {
    await pg.close();
  });
  it("fails closed on corrupt checkpoint JSON without stranding its lease", async () => {
    const run = randomUUID();
    await store.claim("2026-11-16", run);
    await db.execute(
      sql`UPDATE briefings SET checkpoint = '{"phase":"broken"}'::jsonb, lease_until=NULL, run_id=NULL`,
    );
    await expect(store.claim("2026-11-16", randomUUID())).rejects.toThrow(
      "Saved briefing checkpoint is invalid",
    );
    const [row] = await db.select().from(schema.briefings);
    expect(row.status).toBe("failed");
    expect(row.runId).toBeNull();
    expect(row.leaseUntil).toBeNull();
    expect(row.checkpoint).toEqual({ phase: "broken" });
  });
  it("hydrates published read models through the same database queries used by pages", async () => {
    const reader = createEditionReader(testDb);
    expect(await reader.latest()).toBeNull();
    const run = randomUUID();
    await store.claim("2026-11-16", run);
    await store.publish("2026-11-16", run, checkpoint());
    const edition = await reader.byDate("2026-11-16");
    expect(edition?.stories.map((s) => s.id)).toEqual(["a"]);
    expect(edition?.sample).toBe(false);
    expect((await reader.latest())?.date).toBe("2026-11-16");
    expect((await reader.list())[0].count).toBe(1);
    await db.execute(sql`UPDATE briefing_articles SET category='invalid'`);
    await expect(reader.latest()).rejects.toThrow();
  });
  it("grants only one lease for concurrent claims", async () => {
    const claims = await Promise.all([
      store.claim("2026-11-16", randomUUID()),
      store.claim("2026-11-16", randomUUID()),
    ]);
    expect(claims.map((c) => c.status).sort()).toEqual(["acquired", "busy"]);
  });
  it("does not repeat published stories across consecutive daily runs", async () => {
    const old = article("old", { title: "OpenAI releases Orion model weights" });
    const fresh = article("fresh", {
      sourceId: "microsoft-research",
      title: "Microsoft releases a neural inference SDK",
    });
    const deps = {
      store,
      editor: createEditor(),
      radar: async () => ({ repositories: [], unavailable: 0, releaseFailures: 0 }),
      collect: async () => ({ articles: [old], reports: [] }),
    };
    expect((await runPipeline("2026-11-16", deps)).status).toBe("published");
    const result = await runPipeline("2026-11-17", {
      ...deps,
      collect: async () => ({ articles: [old, fresh], reports: [] }),
    });
    expect(result.status).toBe("published");
    expect(result.outcomes?.previouslyPublished).toBe(1);
    expect(
      (await db.select().from(schema.briefingArticles)).map((r) => r.articleId).sort(),
    ).toEqual(["fresh", "old"]);
    expect(await store.recentArticles("2026-11-17")).toEqual([
      { id: old.id, url: old.url, title: old.title, sourceId: old.sourceId },
    ]);
    expect(await store.recentArticles("2026-12-18")).toEqual([]);
  });
  it("revises today atomically while preserving the historical edition", async () => {
    const date = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.parse(date) - 86400000).toISOString().slice(0, 10);
    for (const day of [yesterday, date]) {
      const run = randomUUID();
      await store.claim(day, run);
      await store.publish(day, run, checkpoint());
    }
    const [current] = await db
      .select()
      .from(schema.briefings)
      .where(sql`${schema.briefings.date}=${date}`);
    const draft = checkpoint();
    draft.articles = [article("corrected")];
    draft.selected = [{ ...draft.articles[0], category: "Models" }];
    draft.stories = [story("corrected")];
    await reviseToday(date, current.publishedAt!, draft, testDb);
    expect(
      (await db.select().from(schema.briefingArticles)).map((r) => r.articleId).sort(),
    ).toEqual(["a", "corrected"]);
    expect((await db.select().from(schema.briefings)).every((b) => b.status === "published")).toBe(
      true,
    );
    await expect(reviseToday(yesterday, current.publishedAt!, draft, testDb)).rejects.toThrow(
      "Only today's",
    );
  });
  it("restores the original stories if a revision fails or the review is stale", async () => {
    const date = new Date().toISOString().slice(0, 10);
    const run = randomUUID();
    await store.claim(date, run);
    await store.publish(date, run, checkpoint());
    const [current] = await db.select().from(schema.briefings);
    const draft = checkpoint();
    draft.articles = [];
    await expect(reviseToday(date, current.publishedAt!, draft, testDb)).rejects.toThrow();
    expect((await db.select().from(schema.briefingArticles)).map((r) => r.articleId)).toEqual([
      "a",
    ]);
    expect((await db.select().from(schema.briefings))[0].status).toBe("published");
    await expect(reviseToday(date, new Date(0), checkpoint(), testDb)).rejects.toThrow(
      "changed after review",
    );
  });
  it("publishes atomically and never republishes a date", async () => {
    const run = randomUUID();
    await store.claim("2026-11-16", run);
    await store.save("2026-11-16", run, checkpoint());
    await store.publish("2026-11-16", run, checkpoint());
    expect((await db.select().from(schema.briefings))[0].status).toBe("published");
    expect(await db.select().from(schema.briefingArticles)).toHaveLength(1);
    expect((await store.claim("2026-11-16", randomUUID())).status).toBe("published");
  });
  it("recovers an expired lease and rejects a stale publisher", async () => {
    const oldRun = randomUUID();
    const newRun = randomUUID();
    await store.claim("2026-11-16", oldRun);
    await store.save("2026-11-16", oldRun, checkpoint());
    await db.execute(sql`UPDATE briefings SET lease_until = now() - interval '1 second'`);
    const claimed = await store.claim("2026-11-16", newRun);
    expect(claimed.status).toBe("acquired");
    await expect(store.publish("2026-11-16", oldRun, checkpoint())).rejects.toThrow("lease lost");
    await store.publish("2026-11-16", newRun, checkpoint());
  });
  it("rolls back story inserts if publication fails", async () => {
    const run = randomUUID();
    await store.claim("2026-11-16", run);
    const cp = checkpoint();
    cp.stories.push(cp.stories[0]);
    cp.articles.push(cp.articles[0]);
    await expect(store.publish("2026-11-16", run, cp)).rejects.toThrow();
    expect(await db.select().from(schema.articles)).toHaveLength(0);
    expect((await db.select().from(schema.briefings))[0].status).toBe("processing");
  });
  it("enforces source references and unique edition dates", async () => {
    await expect(
      db.insert(schema.articles).values({
        id: "x",
        sourceId: "unknown",
        title: "Test",
        url: "https://example.com",
        content: "Test",
        publishedAt: new Date(),
      }),
    ).rejects.toThrow();
    await store.claim("2026-11-16", randomUUID());
    await expect(db.insert(schema.briefings).values({ date: "2026-11-16" })).rejects.toThrow();
  });
  it("preserves each edition's source text when the same URL changes later", async () => {
    const firstRun = randomUUID();
    await store.claim("2026-11-15", firstRun);
    await store.publish("2026-11-15", firstRun, checkpoint());
    const cp = checkpoint();
    cp.articles[0].content = "A corrected source body, captured for the next edition.";
    cp.articles[0].title = "A corrected original headline";
    const secondRun = randomUUID();
    await store.claim("2026-11-16", secondRun);
    await store.publish("2026-11-16", secondRun, cp);
    const rows = await db.select().from(schema.briefingArticles);
    expect(rows.map((row) => row.sourceSnapshot.content)).toContain(
      checkpoint().articles[0].content,
    );
    expect(rows.map((row) => row.sourceSnapshot.content)).toContain(cp.articles[0].content);
    expect(await db.select().from(schema.articles)).toHaveLength(1);
  });
  it("backfills source snapshots before enforcing the new NOT NULL constraint", async () => {
    const legacy = new PGlite();
    try {
      await legacy.exec(await readFile("drizzle/0000_outgoing_nightcrawler.sql", "utf8"));
      const id = randomUUID();
      await legacy.query(
        "INSERT INTO sources (id, name, url) VALUES ('test', 'Original publisher', 'https://example.com/feed')",
      );
      await legacy.query(
        "INSERT INTO articles (id, source_id, title, url, content, published_at) VALUES ('test', 'test', 'Original headline', 'https://example.com/story', 'Original source material.', '2026-11-16T05:00:00Z')",
      );
      await legacy.query("INSERT INTO briefings (id, date) VALUES ($1, '2026-11-16')", [id]);
      await legacy.query(
        "INSERT INTO briefing_articles (briefing_id, article_id, position, category, summary, why_it_matters, evidence) VALUES ($1, 'test', 0, 'Models', 'Summary', 'Context', '[]')",
        [id],
      );
      await legacy.exec(await readFile("drizzle/0001_secret_nico_minoru.sql", "utf8"));
      const result = await legacy.query<{
        source_snapshot: { title: string; sourceName: string; publishedAt: string };
      }>("SELECT source_snapshot FROM briefing_articles");
      expect(result.rows[0].source_snapshot).toMatchObject({
        title: "Original headline",
        sourceName: "Original publisher",
        publishedAt: "2026-11-16T05:00:00.000Z",
      });
    } finally {
      await legacy.close();
    }
  });
});
