import "server-only";
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  date,
  integer,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import type { Article, CollectionReport, Outcomes, Repository, Theme } from "@/lib/types";
import type { Checkpoint } from "@/lib/pipeline/types";

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
});
export const articles = pgTable(
  "articles",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    title: text("title").notNull(),
    url: text("url").notNull(),
    content: text("content").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    collectedAt: timestamp("collected_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("articles_url_unique").on(t.url),
    index("articles_published_idx").on(t.publishedAt),
  ],
);
export const briefings = pgTable(
  "briefings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: date("date", { mode: "string" }).notNull().unique(),
    status: text("status", { enum: ["processing", "published", "failed"] })
      .default("processing")
      .notNull(),
    runId: uuid("run_id"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    checkpoint: jsonb("checkpoint").$type<Checkpoint>(),
    title: text("title"),
    description: text("description"),
    repositories: jsonb("repositories").$type<Repository[]>().default([]).notNull(),
    themes: jsonb("themes").$type<Theme[]>().default([]).notNull(),
    reports: jsonb("reports").$type<CollectionReport[]>().default([]).notNull(),
    outcomes: jsonb("outcomes").$type<Outcomes>(),
    partial: integer("partial").default(0).notNull(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    index("briefings_status_date_idx").on(t.status, t.date),
    check("briefings_status_check", sql`${t.status} in ('processing', 'published', 'failed')`),
    check(
      "briefings_publication_check",
      sql`${t.status} <> 'published' or (${t.publishedAt} is not null and ${t.title} is not null)`,
    ),
    check("briefings_partial_check", sql`${t.partial} in (0, 1)`),
  ],
);
export const briefingArticles = pgTable(
  "briefing_articles",
  {
    briefingId: uuid("briefing_id")
      .notNull()
      .references(() => briefings.id, { onDelete: "cascade" }),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id),
    position: integer("position").notNull(),
    category: text("category").notNull(),
    summary: text("summary").notNull(),
    whyItMatters: text("why_it_matters").notNull(),
    evidence: jsonb("evidence").$type<string[]>().notNull(),
    sourceSnapshot: jsonb("source_snapshot").$type<Article>().notNull(),
    summaryKind: text("summary_kind", { enum: ["source-excerpt", "ai", "editorial-sample"] })
      .default("ai")
      .notNull(),
  },
  (t) => [
    uniqueIndex("briefing_article_unique").on(t.briefingId, t.articleId),
    uniqueIndex("briefing_position_unique").on(t.briefingId, t.position),
    check("briefing_position_check", sql`${t.position} >= 0`),
  ],
);
