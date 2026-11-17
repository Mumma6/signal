import "server-only";
import type { Article, Category } from "@/lib/types";
import type { Evaluation } from "@/lib/editorial/types";
import { sourceDefinitions } from "@/lib/sources/registry";

export const stopWords = new Set(
  "a an the and or for to of in on at with from by as is are was were be been being it its this that these those your our their my you we they how what why when where who which into about through over under more most new latest introducing introduce using use used build building get getting make making now today can could will would should has have had not no all one two first next just than then also very much many some here there guide tutorial best top ai llm llms model models release releases update updates developer developers development tool tools project projects code coding open source learn learning".split(
    " ",
  ),
);
export function stem(word: string) {
  return word.length > 5 && word.endsWith("ies")
    ? `${word.slice(0, -3)}y`
    : word.length > 4 && word.endsWith("s") && !word.endsWith("ss")
      ? word.slice(0, -1)
      : word;
}
export function words(text: string) {
  return text.toLowerCase().match(/[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*/g) ?? [];
}
function titleTerms(title: string) {
  return new Set(
    words(title)
      .filter((w) => !stopWords.has(w))
      .map(stem),
  );
}
const contextPatterns = [
  /\bartificial intelligence\b/i,
  /\bAI\b/,
  /\bLLMs?\b/i,
  /\b(?:machine|deep) learning\b/i,
  /\b(?:agentic|agents?|inference|transformers?|embeddings?|reasoning)\b/i,
  /\b(?:Claude|Anthropic|Codex|OpenAI|Gemini|Grok|Mistral|Qwen|Llama|Cursor)\b/i,
  /\b(?:neural|diffusion|multimodal|fine.tun\w*|retrieval|RAG)\b/i,
];
const focusedSources = new Set([
  "openai",
  "codex",
  "anthropic",
  "claude-code",
  "cursor",
  "xai",
  "mistral",
  "deepmind",
  "gemini",
  "gemini-models",
  "huggingface",
  "arxiv",
  "aws-ml",
  "github-ai",
]);

export function classifyArticle(article: Article): Category {
  const text = `${article.title} ${article.content.slice(0, 600)}`;
  if (
    ["codex", "claude-code", "cursor"].includes(article.sourceId) ||
    /\b(?:SDK|API|CLI|protocol|workflow|framework|coding agent|software|agent teams?)\b/i.test(text)
  )
    return "Developer tools";
  if (
    article.sourceId === "arxiv" ||
    /\b(?:research|paper|study|benchmark|experiment)\b/i.test(text)
  )
    return "Research";
  if (/\b(?:open.source|open.weight|Apache|MIT licen[sc]e)\b/i.test(text)) return "Open source";
  if (/\b(?:model|multimodal|reasoning|Gemini|Claude|Grok|Mistral|Qwen|Llama)\b/i.test(text))
    return "Models";
  return "Industry";
}
export function scoreArticle(article: Article) {
  const text = `${article.title} ${article.content.slice(0, 1600)}`;
  const hits = contextPatterns.filter((pattern) => pattern.test(text)).length;
  const titleHits = contextPatterns.filter((pattern) => pattern.test(article.title)).length;
  if (!hits && !focusedSources.has(article.sourceId)) return 15;
  if (!focusedSources.has(article.sourceId) && !titleHits && hits < 2) return 30;
  const source = sourceDefinitions.find((s) => s.id === article.sourceId);
  // Separate headline evidence from body keywords: long vendor prose should not
  // outrank a concrete release just by mentioning agents, APIs and workflows.
  let score = 28 + Math.min(20, titleHits * 5) + Math.min(10, hits * 2);
  if (focusedSources.has(article.sourceId)) score += 8;
  if (source?.group === "research") score += article.sourceId === "arxiv" ? 2 : 8;
  if (source?.group === "community") score += 4;
  if (
    /\b(?:launch(?:es|ed)?|releas(?:e[sd]?|ing)|introduc(?:es?|ed|ing)|announc(?:es?|ed|ing)|available|roll(?:ing)? out|new model|open.weights?)\b/i.test(
      article.title,
    )
  )
    score += 18;
  if (
    /\b(?:API|SDK|CLI|MCP|weights|inference|benchmark|evaluation|research|coding|software|framework|language models?|visual agents?)\b/i.test(
      article.title,
    )
  )
    score += 10;
  if (
    /\b(?:API|SDK|CLI|implementation|weights|inference|evaluation|research|software|framework)\b/i.test(
      article.content.slice(0, 1600),
    )
  )
    score += 6;
  if (
    /\b(?:model|agent|LLM|MCP|inference|reasoning|neural|embedding|transformer|fine.tun|post.train)/i.test(
      article.title,
    )
  )
    score += 6;
  if (/\b(?:software|engineering|workflow|coding|caching|optimization)\b/i.test(article.title))
    score += 8;
  if (["codex", "claude-code"].includes(article.sourceId)) score += 20;
  // Customer stories and partnership announcements are not daily technical news.
  if (
    /\b(?:partnership|customer engagement|case study|customer story)\b/i.test(article.title) ||
    /^how (?!to\b).+\b(?:built|uses?|transforms?|raises|scales|modernizes|leverages)\b/i.test(
      article.title,
    ) ||
    /\/(?:customers?|customer-stories|case-studies)\//i.test(article.url)
  )
    return Math.min(45, score);
  if (/\b(?:sponsored|affiliate|discount code|IPO|stock market|fundrais|funding round)/i.test(text))
    score -= 25;
  if (
    /\b(?:top|best)\s+\d+\b|\b\d+\s+(?:top|best)\b|\b(?:earn money|passive income|buy now)\b/i.test(
      article.title,
    )
  )
    score -= 30;
  if (/\b(?:guide|tutorial|how to|best practices)\b/i.test(article.title)) score -= 6;
  return Math.max(0, Math.min(98, score));
}
export function sameDevelopment(a: Pick<Article, "title">, b: Pick<Article, "title">) {
  const versions = (title: string) =>
    (title.match(/\b\d+(?:\.\d+)+(?:[-.]\w+)?\b/g) ?? []).sort().join(",");
  if (versions(a.title) !== versions(b.title)) return false;
  const left = titleTerms(a.title);
  const right = titleTerms(b.title);
  const common = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;
  return common >= 3 && common / Math.max(1, union) >= 0.72;
}
export function evaluateArticles(articles: readonly Article[]): Evaluation[] {
  const ranked = articles
    .map((article) => ({ article, score: scoreArticle(article) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.article.publishedAt.localeCompare(a.article.publishedAt) ||
        a.article.id.localeCompare(b.article.id),
    );
  const roots: Article[] = [];
  const result = new Map<string, Evaluation>();
  for (const { article, score } of ranked) {
    const duplicate = roots.find((root) => sameDevelopment(root, article));
    if (!duplicate) roots.push(article);
    result.set(article.id, {
      id: article.id,
      score,
      category: classifyArticle(article),
      duplicateOf: duplicate?.id ?? null,
      reason: duplicate
        ? "Overlapping headline coverage of the same development."
        : score >= 60
          ? "Matches AI relevance and technical usefulness rules."
          : "Insufficient AI relevance or low-signal promotional coverage.",
    });
  }
  return articles.map((article) => result.get(article.id)!);
}
export function sourceExcerpt(content: string) {
  const substantive = content.replace(/^This post was co-written[^.]*\.\s*/i, "").trim();
  const selected = substantive.split(/\s+/).slice(0, 25);
  while (selected.join(" ").length > 220 && selected.length) selected.pop();
  const excerpt = selected.join(" ");
  if (excerpt.length < 60) throw new Error("Not enough readable source material for an excerpt");
  return excerpt;
}
export function selectionContext(article: Article, category: Category) {
  const source = sourceDefinitions.find((s) => s.id === article.sourceId);
  const scope =
    source?.group === "research"
      ? "Research coverage"
      : source?.group === "community"
        ? "Community or independent coverage"
        : "An official update";
  return `${scope} from ${article.sourceName}, selected for ${category.toLowerCase()} coverage. Read the original for details, scope, and limitations.`;
}
