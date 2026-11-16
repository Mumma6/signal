import { createEditor } from "./editor";
import { createStore } from "./store";
import { runPipeline } from "./run";
import { collectArticles } from "@/lib/sources/collect";
import { collectRepositories } from "@/lib/sources/github";
export function generateBriefing(date = new Date().toISOString().slice(0, 10)) {
  return runPipeline(date, {
    editor: createEditor(),
    store: createStore(),
    collect: () => {
      if (date !== new Date().toISOString().slice(0, 10))
        throw new Error(
          "Only today's UTC edition can collect live sources. Older dates can resume saved progress or return an existing edition.",
        );
      return collectArticles();
    },
    radar: collectRepositories,
  });
}
