import "server-only";
import { cache } from "react";
import { createEditionReader } from "./db/edition-reader";
import { sampleEdition } from "./preview";
import type { Edition, EditionIndexItem } from "./types";

// Composition owns preview policy and React request deduplication; the reader
// only knows PostgreSQL and published edition models.
export const getLatestEdition = cache(async (): Promise<Edition | null> => {
  if (!process.env.DATABASE_URL) return sampleEdition;
  return createEditionReader().latest();
});
export const getEdition = cache(async (date: string): Promise<Edition | null> => {
  if (!process.env.DATABASE_URL) return date === sampleEdition.date ? sampleEdition : null;
  return createEditionReader().byDate(date);
});
export const listEditions = cache(async (): Promise<EditionIndexItem[]> => {
  if (!process.env.DATABASE_URL)
    return [
      {
        id: sampleEdition.id,
        date: sampleEdition.date,
        title: sampleEdition.title,
        description: sampleEdition.description,
        sample: true,
        sampleKind: sampleEdition.sampleKind,
        count: sampleEdition.stories.length,
      },
    ];
  return createEditionReader().list();
});

export function toBriefingView(edition: Edition): import("./presentation").BriefingView {
  return {
    date: edition.date,
    stories: edition.stories,
    repositories: edition.repositories,
    themes: edition.themes,
    sample: edition.sample,
    sampleKind: edition.sampleKind,
    partial: edition.partial,
  };
}
