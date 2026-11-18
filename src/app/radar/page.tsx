import type { Metadata } from "next";
import { GitFork as Github, ArrowUpRight } from "lucide-react";
import { getLatestEdition } from "@/lib/editions";
import { RadarCard } from "@/components/radar/radar-card";
import { formatDate } from "@/lib/utils";
export const metadata: Metadata = {
  title: "GitHub Radar",
  description:
    "Popular AI open-source projects with at least 1,000 stars, recent development activity, and declared licensing.",
};
export const dynamic = "force-dynamic";
export default async function RadarPage() {
  const edition = await getLatestEdition();
  return (
    <main className="site-container pb-16">
      <section className="page-intro">
        <span className="eyebrow flex items-center gap-2 text-signal">
          <Github className="size-3.5" />
          GITHUB RADAR
        </span>
        <h1>
          Follow the code.
          <br />
          <span className="text-muted-foreground">Find what’s next.</span>
        </h1>
        <p>
          Popular AI projects. Recent activity. The latest releases. Every project has at least
          1,000 stars and a declared license.
        </p>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-5">
        <span className="eyebrow">
          POPULAR & ACTIVE{" "}
          <span className="ml-2 text-muted-foreground">
            / {edition?.repositories.length ?? 0} PROJECTS
          </span>
        </span>
        <span className="text-[10px] text-muted-foreground">
          {edition?.sample
            ? `Discovery preview · Captured ${formatDate(edition.date)}`
            : edition
              ? `Snapshot: ${formatDate(edition.date)}`
              : "Awaiting the first collection"}
        </span>
      </div>
      <div className="radar-grid">
        {edition?.repositories.map((repo) => (
          <RadarCard key={repo.name} repo={repo} />
        ))}
      </div>
      {!edition?.repositories.length && (
        <p className="py-12 text-sm text-muted-foreground">
          No GitHub snapshot is available yet. The next successful collection will populate this
          watchlist.
        </p>
      )}
      <div className="editorial-note">
        <h2>Discovery with context.</h2>
        <p>
          Signal searches GitHub’s LLM, AI agent, and machine-learning topics for projects with at
          least 1,000 stars and a push within 14 days. Established projects are welcome; freshness
          comes from development activity and releases. It requires a declared license, a meaningful
          description, and a code language, and excludes forks, mirrors, archived repositories,
          templates, and common link collections. Picks are balanced across topics and owners,
          ordered by recent push within each topic. Stars are a popularity threshold, rather than a
          quality or safety assessment. Activity and releases reflect the dated collection.
        </p>
        <a
          href="https://github.com/topics/artificial-intelligence"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-signal"
        >
          Keep exploring on GitHub
          <ArrowUpRight className="size-3" />
        </a>
      </div>
    </main>
  );
}
