"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  GitFork as Github,
  Radio,
  Sparkles,
} from "lucide-react";
import type { Edition, Story, Category } from "@/lib/types";
import { categories } from "@/lib/types";
import { cn, formatDate, readingMinutes } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { SignalArt } from "./signal-art";
import { RadarCard } from "./radar-card";
import { SourceDetails } from "./source-details";
import { ShareButton } from "./share-button";
import { ConversationThemes } from "./themes";

function CategoryBadge({ category }: { category: Category }) {
  return (
    <Badge
      className={cn(
        "category-badge",
        category === "Models" && "border-signal/20 bg-signal/7 text-signal",
        category === "Open source" && "border-emerald-300/15 text-emerald-200/80",
        category === "Developer tools" && "border-violet-300/15 text-violet-200/80",
      )}
    >
      {category}
    </Badge>
  );
}
function SourceLine({ story }: { story: Story }) {
  return (
    <a href={story.url} target="_blank" rel="noopener noreferrer" className="source-link">
      <span className="source-icon">{story.sourceName.slice(0, 1)}</span>
      {story.sourceName}
      <span className="source-date">
        {formatDate(story.publishedAt, { month: "short", day: "numeric" })}
      </span>
      <ArrowUpRight className="size-3" />
    </a>
  );
}
function StoryCard({ story, sample, index }: { story: Story; sample: boolean; index: number }) {
  return (
    <article id={`story-${story.id}`} className="story-card">
      <div className="mb-5 flex items-center justify-between">
        <CategoryBadge category={story.category} />
        <span className="font-mono text-[10px] text-muted-foreground/70">
          {String(index).padStart(2, "0")}
        </span>
      </div>
      <h3 className="story-title">
        <a href={story.url} target="_blank" rel="noopener noreferrer">
          {story.title}
          <ArrowUpRight className="ml-1.5 inline size-4 text-muted-foreground" />
        </a>
      </h3>
      {story.summaryKind === "source-excerpt" && (
        <span className="eyebrow mt-3 text-muted-foreground/75">FROM THE SOURCE</span>
      )}
      <p className="mt-3 text-[13px] leading-[1.85] text-muted-foreground">
        {story.summary}
        {story.summaryKind === "source-excerpt" ? "…" : ""}
      </p>
      <details className="why-details group">
        <summary className="mt-5 flex cursor-pointer list-none items-center justify-between text-[11px] font-medium text-signal">
          {story.summaryKind === "source-excerpt" ? "Why it’s here" : "Why it matters"}
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <p className="mt-3 border-l border-signal/35 pl-3 text-[12px] leading-[1.8] text-muted-foreground">
          {story.whyItMatters}
          <span className="mt-2 block text-[9px] uppercase tracking-wider text-muted-foreground/70">
            {story.summaryKind === "source-excerpt" ? "Selection context" : "Editorial perspective"}
          </span>
        </p>
      </details>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <SourceLine story={story} />
        <SourceDetails story={story} sample={sample} />
      </div>
    </article>
  );
}
export function Briefing({
  edition,
  archive = false,
  stale = false,
}: {
  edition: Edition;
  archive?: boolean;
  stale?: boolean;
}) {
  const [filter, setFilter] = useState<Category | "All stories">("All stories");
  const lead = edition.stories[0];
  const supporting = edition.stories.slice(1);
  const available = categories.filter((c) => supporting.some((s) => s.category === c));
  const filtered = supporting.filter((s) => filter === "All stories" || s.category === filter);
  return (
    <main>
      <section className="hero site-container">
        <div className="hero-copy">
          <div className="eyebrow mb-6 flex items-center gap-2.5 text-signal">
            <span className="status-dot" />
            {archive ? "FROM THE ARCHIVE" : "YOUR DAILY DOSE OF CLARITY"}
          </div>
          <h1>
            {archive ? (
              <>
                A moment in AI.
                <br />
                <span>Worth revisiting.</span>
              </>
            ) : (
              <>
                Stay ahead of AI.
                <br />
                <span>Without the noise.</span>
              </>
            )}
          </h1>
          <p className="hero-description">
            The developments that matter. The context you need.
            <br className="hidden sm:block" /> One considered briefing, every day.
          </p>
          <a
            href="#the-briefing"
            className="mt-7 inline-flex items-center gap-2 text-xs font-medium text-foreground transition-colors hover:text-signal"
          >
            {archive ? "Read this edition" : "Get the briefing"}
            <ArrowDown className="size-3.5 text-signal" />
          </a>
        </div>
        <SignalArt />
      </section>
      <div className="site-container">
        <div id="the-briefing" className="edition-bar scroll-mt-24">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="edition-label">
              {edition.sample
                ? edition.sampleKind === "source-snapshot"
                  ? "SOURCE SNAPSHOT"
                  : "THE SAMPLE EDITION"
                : archive
                  ? "THE DAILY EDITION"
                  : "THE LATEST EDITION"}
            </span>
            <span className="hidden h-3 w-px bg-border sm:block" />
            <time dateTime={edition.date} className="text-xs text-muted-foreground">
              {formatDate(edition.date, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          </div>
          <div className="flex items-center gap-5">
            <span className="hidden text-[11px] text-muted-foreground sm:block">
              {edition.stories.length} stories
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock3 className="size-3" />
              {readingMinutes(edition.stories)} min read
            </span>
            <ShareButton path={`/briefing/${edition.date}`} />
          </div>
        </div>
        {edition.sample && (
          <p className="edition-notice">
            <Radio className="size-3.5 shrink-0 text-signal/80" />
            <span>
              {edition.sampleKind === "source-snapshot"
                ? `A source snapshot captured on ${formatDate(edition.date)}. This is a dated preview, rather than a live edition. `
                : "You’re exploring a sample edition with real stories from April 2025. "}
              <Link href="/about#how-it-works">
                See how Signal works <ArrowUpRight className="inline size-3" />
              </Link>
            </span>
          </p>
        )}
        {stale && !archive && (
          <p className="edition-notice">
            <Clock3 className="size-3.5 shrink-0" />
            Showing the latest published edition. The next briefing is on its way.
          </p>
        )}
        {edition.partial && (
          <p className="edition-notice text-amber-200/70">
            This is a shorter edition: some sources or processing steps were unavailable. All
            published summaries passed source checks.
          </p>
        )}
        <div className="briefing-layout">
          <div className="min-w-0">
            <div className="section-heading">
              <h2>
                <span className="section-dot" />
                The big picture
              </h2>
              <span>START HERE</span>
            </div>
            <article className="lead-story">
              <div className="lead-art">
                <SignalArt compact />
                <div className="lead-art-label">
                  <span className="font-mono text-[10px] tracking-[.18em] text-signal/80">
                    IN FOCUS
                  </span>
                  <span className="mt-2 text-[44px] font-light tracking-[-2px]">
                    {edition.sample && edition.sampleKind !== "source-snapshot"
                      ? "open possibilities."
                      : "a clearer perspective."}
                  </span>
                </div>
                <span className="lead-art-corner">
                  <Sparkles className="size-3" /> A SIGNAL WORTH YOUR TIME
                </span>
              </div>
              <div className="lead-body">
                <div className="mb-5 flex items-center gap-3">
                  <CategoryBadge category={lead.category} />
                  <span className="text-[10px] text-muted-foreground">THE LEAD STORY</span>
                </div>
                <h2 className="lead-title">
                  <a href={lead.url} target="_blank" rel="noopener noreferrer">
                    {lead.title}
                    <ArrowUpRight className="ml-2 inline size-6 text-signal/70" />
                  </a>
                </h2>
                {lead.summaryKind === "source-excerpt" && (
                  <span className="eyebrow mt-4 block text-muted-foreground/75">
                    FROM THE SOURCE
                  </span>
                )}
                <p className="mt-4 text-sm leading-[1.9] text-muted-foreground">
                  {lead.summary}
                  {lead.summaryKind === "source-excerpt" ? "…" : ""}
                </p>
                <div className="lead-perspective">
                  <span className="eyebrow text-signal">
                    {lead.summaryKind === "source-excerpt" ? "WHY IT’S HERE" : "WHY IT MATTERS"}
                  </span>
                  <p>{lead.whyItMatters}</p>
                  <span className="mt-2 block text-[9px] uppercase tracking-[.1em] text-muted-foreground/70">
                    {lead.summaryKind === "source-excerpt"
                      ? "Selection context"
                      : "Editorial perspective"}
                  </span>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <SourceLine story={lead} />
                  <SourceDetails story={lead} sample={edition.sample} />
                </div>
              </div>
            </article>
          </div>
          <aside className="briefing-aside">
            <div className="section-heading">
              <h2>The short version</h2>
              <span>TL;DR</span>
            </div>
            <div className="short-version">
              <span className="eyebrow text-muted-foreground">IF YOU READ THREE THINGS</span>
              <ol className="mt-6 space-y-6">
                {edition.stories.slice(0, 3).map((s, i) => (
                  <li key={s.id} className="flex items-start gap-3">
                    <span className="font-mono text-[11px] text-signal/70">0{i + 1}</span>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] leading-[1.75] text-foreground/85 hover:text-signal"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
              <p className="mt-7 border-t border-border pt-4 text-[10px] leading-relaxed text-muted-foreground">
                Short excerpts. Original sources.
                <br />A useful starting point, never the whole story.
              </p>
            </div>
            <div className="radar-aside">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  <Github className="size-4 text-muted-foreground" />
                  On our radar
                </h2>
                <Link
                  href="/radar"
                  aria-label="Explore GitHub Radar"
                  className="text-muted-foreground hover:text-signal"
                >
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>
              <p className="mb-4 text-[11px] leading-relaxed text-muted-foreground">
                Open source worth a closer look.
              </p>
              {edition.repositories.length ? (
                edition.repositories
                  .slice(0, 2)
                  .map((repo) => <RadarCard key={repo.name} repo={repo} compact />)
              ) : (
                <p className="py-4 text-xs text-muted-foreground">
                  The GitHub snapshot is unavailable for this edition.
                </p>
              )}
              <Link
                href="/radar"
                className="mt-5 inline-flex items-center gap-2 text-[11px] text-signal"
              >
                Explore GitHub Radar
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </aside>
        </div>
        <ConversationThemes themes={edition.themes ?? []} />
        <section className="more-stories">
          <div className="section-heading">
            <h2>
              More worth knowing
              <span className="ml-3 text-[11px] font-normal text-muted-foreground">
                {edition.stories.length - 1} more signals
              </span>
            </h2>
            <span>THE BRIEFING CONTINUES</span>
          </div>
          <div className="topic-filters" role="group" aria-label="Filter stories by topic">
            {(["All stories", ...available] as const).map((category) => (
              <button
                key={category}
                onClick={() => setFilter(category)}
                aria-pressed={filter === category}
                className={cn("topic-filter", filter === category && "selected")}
              >
                {category}
                {category === "All stories" && (
                  <span className="ml-1.5 text-[9px] opacity-60">{edition.stories.length - 1}</span>
                )}
              </button>
            ))}
          </div>
          <div className="story-grid">
            {filtered.map((story, i) => (
              <StoryCard key={story.id} story={story} sample={edition.sample} index={i + 2} />
            ))}
          </div>
          {!filtered.length && (
            <p className="py-12 text-sm text-muted-foreground">
              The lead story is the only signal in this edition.
            </p>
          )}
        </section>
        <section className="caught-up">
          <div className="caught-check">
            <Check className="size-4" />
          </div>
          <h2>You’re all caught up.</h2>
          <p>A clearer view of AI. A little more room to think.</p>
          <Button asChild variant="outline" size="sm" className="mt-5">
            <Link href="/archive">
              Explore past briefings
              <ArrowRight />
            </Link>
          </Button>
          <span className="mt-8 font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground/60">
            Less scrolling. More understanding.
          </span>
        </section>
      </div>
    </main>
  );
}
