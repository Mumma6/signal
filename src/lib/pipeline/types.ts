import type { Article, Outcomes } from "@/lib/types";

import type { z } from "zod";
import type { checkpointSchema } from "./checkpoint";
export type Checkpoint = z.infer<typeof checkpointSchema>;
export interface PipelineStore {
  recentArticles(date: string): Promise<Pick<Article, "id" | "url" | "title" | "sourceId">[]>;
  claim(
    date: string,
    runId: string,
  ): Promise<
    { status: "acquired"; checkpoint: Checkpoint | null } | { status: "busy" | "published" }
  >;
  save(date: string, runId: string, checkpoint: Checkpoint): Promise<void>;
  publish(date: string, runId: string, checkpoint: Checkpoint): Promise<void>;
  release(date: string, runId: string, error?: string, discardCheckpoint?: boolean): Promise<void>;
}
export type PipelineResult = { date: string } & (
  | { status: "published"; partial: boolean; outcomes: Outcomes }
  | { status: "pending" | "no-new-stories"; outcomes?: Outcomes; partial?: never }
  | { status: "already-published" | "busy"; outcomes?: never; partial?: never }
);
