import { ArrowUpRight, Radio } from "lucide-react";
import type { Theme } from "@/lib/types";
export function ConversationThemes({ themes }: { themes: Theme[] }) {
  if (!themes.length) return null;
  return (
    <section className="mt-10 border-y border-border py-7" aria-labelledby="conversation-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="conversation-heading" className="flex items-center gap-2 text-sm font-medium">
          <Radio className="size-3.5 text-signal" />
          In the conversation
        </h2>
        <span className="eyebrow text-muted-foreground">RECURRING THEMES · PAST WEEK</span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Patterns recurring across independent sources in the past week’s collection.
      </p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => (
          <article key={theme.title} className="rounded-md border border-border bg-card/40 p-5">
            <span className="eyebrow text-signal">{theme.publisherCount} SOURCE GROUPS</span>
            <h3 className="mt-3 text-lg font-medium tracking-tight">{theme.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{theme.summary}</p>
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2">
              {theme.sources.slice(0, 4).map((source) => (
                <a
                  key={source.articleId}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={source.title}
                  className="inline-flex items-center gap-1 text-[10px] text-signal/85 hover:text-signal"
                >
                  {source.sourceName}
                  <ArrowUpRight className="size-2.5" />
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
