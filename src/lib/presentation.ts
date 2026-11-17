import { z } from "zod";
import type { Edition } from "./types";

// Public reading and search contracts; no credentials or generation state.
const count = z.number().int().nonnegative();
export const editionIndexSchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string(),
  description: z.string(),
  count,
  sample: z.boolean(),
  sampleKind: z.enum(["historical", "source-snapshot"]).optional(),
});

export type BriefingView = Pick<
  Edition,
  "date" | "stories" | "repositories" | "themes" | "sample" | "sampleKind" | "partial"
>;
