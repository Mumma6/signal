import type { Story } from "@/lib/types";
import type { Checkpoint } from "./types";

export function isPartial(cp: Checkpoint) {
  return (
    cp.outcomes.sourcesUnavailable > 0 ||
    cp.stories.length < cp.selected.length ||
    cp.outcomes.releaseFailures > 0
  );
}
export function editionCopy(stories: Story[]) {
  return {
    title: stories[0]?.title ?? "The daily AI briefing",
    description: `${stories.length} developments worth your attention. Grounded summaries, original sources, and a little perspective.`,
  };
}
