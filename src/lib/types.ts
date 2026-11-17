import { z } from "zod";

export const categories = [
  "Models",
  "Research",
  "Developer tools",
  "Industry",
  "Open source",
] as const;
export const categorySchema = z.enum(categories);
export type Category = z.infer<typeof categorySchema>;
export const articleSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  sourceName: z.string(),
  title: z.string().min(8).max(350),
  url: z.url(),
  content: z.string().min(100).max(6500),
  publishedAt: z.iso.datetime(),
});
export type Article = z.infer<typeof articleSchema>;
export type Story = {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  category: Category;
  summary: string;
  whyItMatters: string;
  evidence: string[];
  summaryKind?: "source-excerpt" | "ai" | "editorial-sample";
};
export type Repository = {
  name: string;
  description: string;
  url: string;
  stars: number | null;
  language: string | null;
  pushedAt: string | null;
  release: string | null;
  releaseUrl: string | null;
  reason: string;
  collectedAt: string;
  createdAt?: string;
  license?: string;
  discoveryTopic?: string;
  releasePublishedAt?: string | null;
};
export type Theme = {
  title: string;
  summary: string;
  publisherCount: number;
  sources: { articleId: string; title: string; url: string; sourceName: string }[];
};
export type CollectionReport = {
  source: string;
  count: number;
  status: "ok" | "unavailable";
  invalid: number;
};
export type Outcomes = {
  previouslyPublished?: number;
  collected: number;
  duplicates: number;
  invalid: number;
  evaluated: number;
  selected: number;
  rejected: number;
  summaries: number;
  sourcesUnavailable: number;
  repositories: number;
  releaseFailures: number;
  summaryFailures: number;
};
export type Edition = {
  id: string;
  date: string;
  title: string;
  description: string;
  stories: Story[];
  repositories: Repository[];
  partial: boolean;
  reports: CollectionReport[];
  outcomes: Outcomes;
  sample: boolean;
  sampleKind?: "historical" | "source-snapshot";
  publishedAt: string;
  themes?: Theme[];
};
