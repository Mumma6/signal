import type { Metadata } from "next";
import { ArrowUpRight, Radio } from "lucide-react";
import { sourceDefinitions } from "@/lib/sources/registry";
export const metadata: Metadata = {
  title: "A little perspective",
  description: "How Signal curates a calmer, more useful daily view of artificial intelligence.",
};
const principles = [
  [
    "01 / COLLECT",
    "Start with the source.",
    "We read official feeds, research abstracts, community blogs, and public APIs. Where no verified feed is available, a narrow reader extracts dated entries from the official update page. Original links and attribution always travel with the story.",
  ],
  [
    "02 / CONSIDER",
    "Find the development, not the hype.",
    "Local rules clean, score, and categorize source material. Headline similarity helps group overlapping coverage, while publisher quotas leave room for independent voices. The same company’s multiple feeds share a quota.",
  ],
  [
    "03 / EXPLAIN",
    "Read the source. Spot the patterns.",
    "Short source excerpts preserve the publisher’s own words. Selection context explains why a story is here. Recurring phrases across multiple independent publisher groups surface themes in the conversation, with links to the evidence. No language model or AI-provider account is involved.",
  ],
  [
    "04 / PUBLISH",
    "One considered edition. Every day.",
    "A daily collection becomes a short briefing and a snapshot of freshly discovered open-source projects. If a source is unavailable, we can publish a partial edition. If no readable excerpts pass the checks, we keep the last edition available.",
  ],
];
export default function AboutPage() {
  return (
    <main className="site-container pb-16">
      <section className="page-intro">
        <span className="eyebrow flex items-center gap-2 text-signal">
          <Radio className="size-3.5" />
          INDEPENDENT BY DESIGN
        </span>
        <h1>
          Less noise.
          <br />
          <span className="text-muted-foreground">A better perspective.</span>
        </h1>
        <p>
          AI moves quickly. Keeping up shouldn’t become a second job. Signal is a quiet place to
          understand what happened, why it matters, and what’s worth a closer look.
        </p>
      </section>
      <div className="border-y border-border py-7">
        <p className="max-w-3xl text-xl font-light leading-relaxed tracking-tight text-foreground/80">
          We believe a useful briefing should leave you feeling informed,{" "}
          <span className="text-signal">with time and attention to spare.</span>
        </p>
      </div>
      <section id="how-it-works" className="about-grid scroll-mt-28">
        {principles.map(([number, title, body]) => (
          <article key={number}>
            <span className="about-step">{number}</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
      <div className="editorial-note">
        <h2>AI news. Provider-free curation.</h2>
        <p>
          Signal is independent and unaffiliated with the companies it covers. Curation, grouping,
          and excerpt selection run locally, with no model calls or inference charges. Rules can
          miss nuance and similarity can miss duplicates. Sources may contain incomplete
          information, and vendor claims are not independent evaluations. Theme counts describe this
          source collection. Always read the originals for important decisions. No accounts,
          personalization, or advertising trackers.
        </p>
        <p className="mt-4">
          Before live publishing is configured, Signal displays a clearly labeled, dated source
          snapshot. Refreshing the local snapshot gathers real source excerpts and GitHub metadata
          without a database or model key. It is a captured preview, rather than a continuously
          updating publication.
        </p>
      </div>
      <section className="mt-12">
        <h2 className="text-lg font-medium tracking-tight">Our source network</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {sourceDefinitions.length} sources across official announcements, developer workflows,
          research, and community perspectives.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {sourceDefinitions.map(({ id, name, website: href }) => (
            <a
              href={href}
              key={id}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-md border border-border px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:border-signal/40 hover:text-foreground"
            >
              {name}
              <ArrowUpRight className="size-3" />
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
