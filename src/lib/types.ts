import type { z } from "zod";
import type * as schemas from "./schemas";
export type Category = z.infer<typeof schemas.categorySchema>;
export type Article = z.infer<typeof schemas.articleSchema>;
export type Story = z.infer<typeof schemas.storySchema>;
export type Repository = z.infer<typeof schemas.repositorySchema>;
export type Theme = z.infer<typeof schemas.themeSchema>;
export type CollectionReport = z.infer<typeof schemas.collectionReportSchema>;
export type Outcomes = z.infer<typeof schemas.outcomesSchema>;
export type Edition = z.infer<typeof schemas.editionSchema>;
export type EditionIndexItem = z.infer<typeof schemas.editionIndexSchema>;

export type NewsCollection = z.infer<typeof schemas.newsCollectionSchema>;
export type RepositoryCollection = {
  repositories: Repository[];
  unavailable: number;
  releaseFailures: number;
};
