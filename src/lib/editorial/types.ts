import type { Article, Category, Story } from "@/lib/types";
export type Evaluation = {
  id: string;
  score: number;
  category: Category;
  duplicateOf: string | null;
  reason: string;
};
export type SelectedArticle = Article & { category: Category };
export type PublishedArticle = Pick<Article, "id" | "url" | "title" | "sourceId">;

export interface Editor {
  evaluate(articles: Article[]): Promise<Evaluation[]>;
  summarize(article: Article & { category: Category }): Promise<Story>;
}
