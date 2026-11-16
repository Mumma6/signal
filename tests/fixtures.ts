import type { Article, Story, Outcomes } from "@/lib/types";
import type { Checkpoint, Editor, PipelineStore } from "@/lib/pipeline/types";
export const article = (id = "a", override: Partial<Article> = {}): Article => ({
  id,
  sourceId: "openai",
  sourceName: "OpenAI",
  title: `Model announcement ${id}`,
  url: `https://example.com/${id}`,
  content:
    "The team released a new open model for language understanding. Developers can download the weights and evaluate the model locally using the published tools.",
  publishedAt: "2026-11-16T05:00:00.000Z",
  ...override,
});
export const story = (id = "a"): Story => ({
  ...article(id),
  category: "Models",
  summary:
    "A team released a language model with downloadable weights and tools for local evaluation.",
  whyItMatters:
    "Local evaluation could help developers assess the model for their own applications.",
  evidence: ["The team released a new open model for language understanding."],
});
export const outcomes = (): Outcomes => ({
  collected: 1,
  duplicates: 0,
  invalid: 0,
  evaluated: 1,
  selected: 1,
  rejected: 0,
  summaries: 1,
  sourcesUnavailable: 0,
  repositories: 0,
  releaseFailures: 0,
  summaryFailures: 0,
});
export const checkpoint = (): Checkpoint => ({
  phase: "publish",
  articles: [article()],
  selected: [{ ...article(), category: "Models" }],
  stories: [story()],
  repositories: [],
  reports: [],
  outcomes: outcomes(),
});
export function memoryStore() {
  let cp: Checkpoint | null = null;
  let state = "new";
  let published: Checkpoint | null = null;
  const store: PipelineStore = {
    async claim() {
      if (state === "published") return { status: "published" };
      if (state === "busy") return { status: "busy" };
      state = "busy";
      return { status: "acquired", checkpoint: structuredClone(cp) };
    },
    async save(_date, _run, checkpoint) {
      cp = structuredClone(checkpoint);
    },
    async publish(_date, _run, checkpoint) {
      state = "published";
      published = structuredClone(checkpoint);
    },
    async release() {
      state = "released";
    },
  };
  return { store, checkpoint: () => cp, published: () => published };
}
export const editor: Editor = {
  async evaluate(articles) {
    return articles.map((a) => ({
      id: a.id,
      score: 90,
      category: "Models",
      duplicateOf: null,
      reason: "A concrete model announcement with practical relevance.",
    }));
  },
  async summarize(article) {
    return story(article.id);
  },
};
