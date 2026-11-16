import type {
  Article,
  Category,
  Story,
  Repository,
  CollectionReport,
  Outcomes,
  Theme,
} from "@/lib/types";
export type Evaluation = {
  id: string;
  score: number;
  category: Category;
  duplicateOf: string | null;
  reason: string;
};
export type Checkpoint = {
  phase: "evaluate" | "summarize" | "publish";
  articles: Article[];
  selected: (Article & { category: Category })[];
  stories: Story[];
  repositories: Repository[];
  reports: CollectionReport[];
  outcomes: Outcomes;
  themes?: Theme[];
};
export interface Editor {
  evaluate(articles: Article[]): Promise<Evaluation[]>;
  summarize(article: Article & { category: Category }): Promise<Story>;
}
export interface PipelineStore {
  claim(
    date: string,
    runId: string,
  ): Promise<
    { status: "acquired"; checkpoint: Checkpoint | null } | { status: "busy" | "published" }
  >;
  save(date: string, runId: string, checkpoint: Checkpoint): Promise<void>;
  publish(date: string, runId: string, checkpoint: Checkpoint): Promise<void>;
  release(date: string, runId: string, error?: string): Promise<void>;
}
export type PipelineResult = {
  status: "published" | "already-published" | "busy" | "pending";
  date: string;
  partial?: boolean;
  outcomes?: Outcomes;
};
