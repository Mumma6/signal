import "server-only";
import { z } from "zod";
export const categories = [
  "Models",
  "Research",
  "Developer tools",
  "Industry",
  "Open source",
] as const;
export const categorySchema = z.enum(categories);
export const articleSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  sourceName: z.string(),
  title: z.string().min(8).max(350),
  url: z.url(),
  content: z.string().min(100).max(6500),
  publishedAt: z.iso.datetime(),
});

const count = z.number().int().nonnegative();
export const storySchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.url(),
  sourceName: z.string(),
  publishedAt: z.iso.datetime(),
  category: categorySchema,
  summary: z.string(),
  whyItMatters: z.string(),
  evidence: z.array(z.string()),
  summaryKind: z.enum(["source-excerpt", "ai", "editorial-sample"]).optional(),
});
export const repositorySchema = z.object({
  name: z.string(),
  description: z.string(),
  url: z.url(),
  stars: count.nullable(),
  language: z.string().nullable(),
  pushedAt: z.iso.datetime().nullable(),
  release: z.string().nullable(),
  releaseUrl: z.url().nullable(),
  reason: z.string(),
  collectedAt: z.iso.datetime(),
  createdAt: z.iso.datetime().optional(),
  license: z.string().optional(),
  discoveryTopic: z.string().optional(),
  releasePublishedAt: z.iso.datetime().nullable().optional(),
});
export const themeSchema = z.object({
  title: z.string(),
  summary: z.string(),
  publisherCount: count,
  sources: z.array(
    z.object({ articleId: z.string(), title: z.string(), url: z.url(), sourceName: z.string() }),
  ),
});
export const collectionReportSchema = z.object({
  source: z.string(),
  count,
  invalid: count,
  status: z.enum(["ok", "unavailable"]),
});
export const outcomesSchema = z.object({
  previouslyPublished: count.optional(),
  collected: count,
  duplicates: count,
  invalid: count,
  evaluated: count,
  selected: count,
  rejected: count,
  summaries: count,
  sourcesUnavailable: count,
  repositories: count,
  releaseFailures: count,
  summaryFailures: count,
});
export const newsCollectionSchema = z.object({
  articles: z.array(articleSchema),
  contextArticles: z.array(articleSchema).optional(),
  reports: z.array(collectionReportSchema),
});
export const editionSchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string(),
  description: z.string(),
  stories: z.array(storySchema),
  repositories: z.array(repositorySchema),
  partial: z.boolean(),
  reports: z.array(collectionReportSchema),
  outcomes: outcomesSchema,
  sample: z.boolean(),
  sampleKind: z.enum(["historical", "source-snapshot"]).optional(),
  publishedAt: z.iso.datetime(),
  themes: z.array(themeSchema).optional(),
});
