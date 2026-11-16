"use client";
import { ArrowUpRight, FileText, Check } from "lucide-react";
import type { Story } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { formatDate } from "@/lib/utils";
export function SourceDetails({ story, sample }: { story: Story; sample: boolean }) {
  const extracted = story.summaryKind === "source-excerpt";
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`Source details for ${story.title}`}
        >
          <FileText className="size-3" />
          Source notes
        </button>
      </DialogTrigger>
      <DialogContent>
        <span className="eyebrow text-signal">BEHIND THE BRIEFING</span>
        <DialogTitle className="mt-3 pr-6 text-xl font-medium leading-snug">
          {story.title}
        </DialogTitle>
        <DialogDescription className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {extracted
            ? "This card contains a short excerpt from the source’s published feed or official update page. Local rules selected and categorized it. No language model or AI provider was used. Read the original for the full context."
            : sample
              ? "This historical sample is hand-edited from the original announcement. It demonstrates the reading experience."
              : "This archived summary was generated from the source’s feed text. Evidence was checked before publication. Read the original for full context."}
        </DialogDescription>
        <div className="my-6 border-y border-border py-4 text-xs text-muted-foreground">
          <p>
            {story.sourceName} · Published {formatDate(story.publishedAt)}
          </p>
          <p className="mt-2 flex items-center gap-1.5">
            <Check className="size-3 text-signal" />
            Original source preserved
          </p>
        </div>
        <h3 className="eyebrow">SOURCE EXCERPT{story.evidence.length > 1 ? "S" : ""}</h3>
        <div className="mt-3 space-y-3">
          {story.evidence.map((quote, i) => (
            <blockquote
              key={i}
              className="border-l-2 border-signal/40 pl-4 text-sm leading-relaxed text-muted-foreground"
            >
              “{quote}”
            </blockquote>
          ))}
        </div>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          {extracted
            ? "“Why it’s here” describes the selection rules and source context. It is not an additional claim made by the publisher."
            : "“Why it matters” is editorial analysis and may include cautious inference. It is not an additional claim from the original source."}
        </p>
        <Button asChild className="mt-6">
          <a href={story.url} target="_blank" rel="noopener noreferrer">
            Read original source
            <ArrowUpRight />
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
