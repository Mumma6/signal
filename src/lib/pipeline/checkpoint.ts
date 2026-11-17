import "server-only";
import { z } from "zod";
import { articleSchema, categorySchema } from "@/lib/schemas";
import {
  collectionReportSchema,
  outcomesSchema,
  repositorySchema,
  storySchema,
  themeSchema,
} from "@/lib/schemas";

// Retain the deployed JSON shape and phase names, including optional fields in
// older checkpoints. Database JSON is an external boundary, not a type assertion.
export const checkpointSchema = z.object({
  collectedAt: z.iso.datetime().optional(),
  // Continues one briefing execution across pending invocations. Not the edition date.
  executionId: z.uuid().optional(),
  phase: z.enum(["evaluate", "summarize", "publish"]),
  articles: z.array(articleSchema),
  selected: z.array(articleSchema.extend({ category: categorySchema })),
  stories: z.array(storySchema),
  repositories: z.array(repositorySchema),
  reports: z.array(collectionReportSchema),
  outcomes: outcomesSchema,
  themes: z.array(themeSchema).optional(),
});
