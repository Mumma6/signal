import "server-only";
import { utcDate } from "@/lib/dates";
import { createEditor } from "@/lib/editorial/editor";
import { createStore } from "@/lib/db/briefing-store";
import { runPipeline } from "./run";
import { collectArticles } from "@/lib/sources/collect";
import { collectRepositories, radarTopics } from "@/lib/sources/github";
import { startBriefingRun } from "@/lib/flowmark";
export function generateBriefing(date = utcDate(new Date())) {
  return runPipeline(date, {
    editor: createEditor(),
    store: createStore(),
    startRun: (executionId) => startBriefingRun(date, executionId),
    collect: () => {
      if (date !== utcDate(new Date()))
        throw new Error(
          "Only today's UTC edition can collect live sources. Older dates can resume saved progress or return an existing edition.",
        );
      return collectArticles();
    },
    radar: collectRepositories,
    radarSourceCount: radarTopics.length,
  });
}
