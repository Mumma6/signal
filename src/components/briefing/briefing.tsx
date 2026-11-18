"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  GitFork as Github,
  Radio,
} from "lucide-react";
import type { BriefingView } from "@/lib/presentation";
import type { Story } from "@/lib/types";
import { cn, formatDate, readingMinutes } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { RadarCard } from "../radar/radar-card";
import { SourceDetails } from "./source-details";
import { ShareButton } from "./share-button";
import { ConversationThemes } from "./themes";

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

export function Briefing({
  edition,
  archive = false,
  stale = false,
}: {
  edition: BriefingView;
  archive?: boolean;
  stale?: boolean;
}) {
  const [position, setPosition] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const story = edition.stories[position];
  const last = position === edition.stories.length - 1;
  function goTo(index: number) {
    if (index < 0 || index >= edition.stories.length) return;
    setPosition(index);
    // Announce the new headline and keep keyboard readers in the article.
    requestAnimationFrame(() => {
      titleRef.current?.focus({ preventScroll: true });
      document
        .getElementById("briefing-reader")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  if (!story) return null;
  return (
    <main className="site-container pb-12">
      <section className="reader-intro">
        <div>
          <div className="eyebrow mb-4 flex items-center gap-2.5 text-signal">
            <span className="status-dot" />
            {archive ? "FROM THE ARCHIVE" : "YOUR DAILY AI BRIEFING"}
          </div>
          <h1>{archive ? "A day worth revisiting." : "Today, without the noise."}</h1>
          <p>{edition.stories.length} things worth knowing. One at a time.</p>
        </div>
        <span className="reader-intro-mark" aria-hidden="true">
          S<span>{"///"}</span>
        </span>
      </section>
      <div className="edition-bar">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="edition-label">
            {edition.sample
              ? "SOURCE SNAPSHOT"
              : archive
                ? "THE DAILY EDITION"
                : "THE LATEST EDITION"}
          </span>
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
            A dated preview captured on {formatDate(edition.date)}.{" "}
            <Link href="/about#how-it-works">
              How Signal works <ArrowUpRight className="inline size-3" />
            </Link>
          </span>
        </p>
      )}
      {stale && !archive && (
        <p className="edition-notice">
          <Clock3 className="size-3.5 shrink-0" />
          Showing the latest published edition. A new briefing appears when fresh stories qualify.
        </p>
      )}
      {edition.partial && (
        <p className="edition-notice text-amber-200/70">
          Some sources or processing steps were unavailable. Every published excerpt passed source
          checks.
        </p>
      )}
      <div className="reader-layout">
        <section
          id="briefing-reader"
          className="min-w-0 scroll-mt-24"
          aria-label="Read the briefing"
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <span className="eyebrow text-signal">
              {position === 0 ? "START HERE" : last ? "THE FINAL SIGNAL" : "THE BRIEFING CONTINUES"}
            </span>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground" aria-live="polite">
                {String(position + 1).padStart(2, "0")}{" "}
                <span className="mx-1 text-muted-foreground/50">/</span>{" "}
                {String(edition.stories.length).padStart(2, "0")}
              </span>
              <Button size="sm" onClick={() => goTo(position + 1)} disabled={last}>
                Next <ArrowRight />
              </Button>
            </div>
          </div>
          <div className="mb-0 flex gap-1.5" aria-hidden="true">
            {edition.stories.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors",
                  i <= position ? "bg-signal" : "bg-border",
                )}
              />
            ))}
          </div>
          <article className="reader-story">
            <div className="mb-6 flex items-center gap-3">
              <Badge className="border-signal/20 bg-signal/7 text-signal">{story.category}</Badge>
              <span className="text-xs text-muted-foreground">{story.sourceName}</span>
            </div>
            <h2 ref={titleRef} tabIndex={-1} className="reader-title outline-none">
              <a
                href={story.url}
                target="_blank"
                rel="noopener noreferrer"
                className="reader-title-link"
              >
                {story.title}
                <ArrowUpRight className="reader-title-arrow" aria-hidden="true" />
              </a>
            </h2>
            <span className="eyebrow mt-7 block text-muted-foreground">
              {story.summaryKind === "source-excerpt" ? "FROM THE SOURCE" : "THE SHORT VERSION"}
            </span>
            <p className="reader-summary">
              {story.summary}
              {story.summaryKind === "source-excerpt" ? "…" : ""}
            </p>
            <div className="lead-perspective">
              <span className="eyebrow text-signal">
                {story.summaryKind === "source-excerpt" ? "WHY IT’S HERE" : "WHY IT MATTERS"}
              </span>
              <p>{story.whyItMatters}</p>
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
              <SourceLine story={story} />
              <SourceDetails story={story} sample={edition.sample} />
            </div>
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-xs text-signal hover:underline"
            >
              Read the original article <ArrowUpRight className="size-3.5" />
            </a>
          </article>
          <nav className="reader-navigation" aria-label="Browse briefing stories">
            <Button variant="outline" onClick={() => goTo(position - 1)} disabled={position === 0}>
              <ArrowLeft />
              Previous
            </Button>
            {last ? (
              <Button asChild>
                <Link href="/radar">
                  Explore GitHub Radar <ArrowRight />
                </Link>
              </Button>
            ) : (
              <Button onClick={() => goTo(position + 1)}>
                Next story <ArrowRight />
              </Button>
            )}
          </nav>
          {last && (
            <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="size-3.5 text-signal" />
              You’ve reached the end of this briefing.
            </p>
          )}
        </section>
        <aside className="reader-aside">
          <div className="section-heading">
            <h2>In this briefing</h2>
            <span>{edition.stories.length} SIGNALS</span>
          </div>
          <ol className="reader-contents">
            {edition.stories.map((s, i) => (
              <li key={s.id}>
                <button
                  onClick={() => goTo(i)}
                  aria-current={i === position ? "step" : undefined}
                  className={cn("reader-contents-button", i === position && "active")}
                >
                  <span className="font-mono text-[10px] text-signal/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{s.title}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="radar-aside">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <Github className="size-4 text-muted-foreground" />
                On our radar
              </h2>
              <Link href="/radar" aria-label="Explore GitHub Radar">
                <ArrowUpRight className="size-4 text-signal" />
              </Link>
            </div>
            {edition.repositories.length ? (
              edition.repositories
                .slice(0, 2)
                .map((repo) => <RadarCard key={repo.name} repo={repo} compact />)
            ) : (
              <p className="text-xs text-muted-foreground">
                The next collection will update this watchlist.
              </p>
            )}
            <Link
              href="/radar"
              className="mt-5 inline-flex items-center gap-2 text-[11px] text-signal"
            >
              Explore popular projects <ArrowRight className="size-3" />
            </Link>
          </div>
        </aside>
      </div>
      <ConversationThemes themes={edition.themes ?? []} />
      <div className="mt-14 flex items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
        <span>A little more informed. A little less overwhelmed.</span>
        <Link href="/archive" className="inline-flex shrink-0 items-center gap-2 hover:text-signal">
          Past briefings <ArrowRight className="size-3" />
        </Link>
      </div>
    </main>
  );
}
