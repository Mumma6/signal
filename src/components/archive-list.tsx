"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
type Item = {
  id: string;
  date: string;
  title: string;
  description: string;
  count: number;
  sample: boolean;
  sampleKind?: "historical" | "source-snapshot";
};
export function ArchiveList({ editions }: { editions: Item[] }) {
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("all");
  const months = [...new Set(editions.map((e) => e.date.slice(0, 7)))];
  const results = editions.filter(
    (e) =>
      (month === "all" || e.date.startsWith(month)) &&
      `${e.title} ${e.description} ${e.date}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="flex flex-col justify-between gap-4 border-y border-border py-5 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-3 size-3.5 text-muted-foreground" />
          <input
            aria-label="Search archive"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a briefing…"
            className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-xs outline-none focus:border-signal"
          />
        </div>
        <div className="flex items-center gap-4">
          <span aria-live="polite" className="whitespace-nowrap text-[11px] text-muted-foreground">
            {results.length} edition{results.length !== 1 ? "s" : ""}
          </span>
          <select
            aria-label="Filter by month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-xs text-muted-foreground outline-none focus:border-signal"
          >
            <option value="all">All months</option>
            {months.map((m) => (
              <option value={m} key={m}>
                {formatDate(`${m}-01`, { month: "long", year: "numeric" })}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mb-20" aria-live="polite">
        {results.map((item) => (
          <Link key={item.id} href={`/briefing/${item.date}`} className="archive-row group">
            <div className="pt-1">
              <p className="!mt-0 font-mono !text-[10px] uppercase">
                {formatDate(item.date, { month: "short", year: "numeric" })}
              </p>
              <span className="mt-1 block text-3xl font-light text-foreground/75">
                {item.date.slice(-2)}
              </span>
            </div>
            <div>
              {item.sample && (
                <span className="eyebrow text-signal">
                  {item.sampleKind === "source-snapshot"
                    ? "SOURCE SNAPSHOT · DATED PREVIEW"
                    : "HISTORICAL SAMPLE EDITION"}
                </span>
              )}
              <h2 className="mt-2">{item.title}</h2>
              <p>{item.description}</p>
              <span className="mt-4 block text-[10px] text-muted-foreground">
                {item.count} stories · Original sources included
              </span>
            </div>
            <ArrowUpRight className="mt-3 size-5 text-muted-foreground group-hover:text-signal" />
          </Link>
        ))}
        {!results.length && (
          <p className="py-20 text-center text-sm text-muted-foreground">
            {editions.length
              ? "No briefings match your search. Try another topic or month."
              : "The archive begins with our first published edition. Check back soon."}
          </p>
        )}
      </div>
    </>
  );
}
