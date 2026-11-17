"use client";
import type { EditionIndexItem } from "@/lib/types";
import { editionIndexSchema } from "@/lib/schemas";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Search, Menu, X, Command } from "lucide-react";
import { SignalWordmark } from "./brand";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Daily briefing" },
  { href: "/radar", label: "GitHub Radar" },
  { href: "/archive", label: "Archive" },
  { href: "/about", label: "About" },
];
export function Header() {
  const path = usePathname();
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<EditionIndexItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!search || items !== null) return;
    const controller = new AbortController();
    fetch("/api/editions", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((value) => setItems(editionIndexSchema.array().parse(value)))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [search, items]);
  const results = (items ?? [])
    .filter((item) =>
      `${item.title} ${item.description} ${item.date}`.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 8);
  return (
    <>
      <header className="site-header">
        <div className="site-container flex h-[82px] items-center justify-between gap-6">
          <Link href="/" aria-label="Signal home">
            <SignalWordmark />
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={
                  (
                    link.href === "/"
                      ? path === "/" || path.startsWith("/briefing/")
                      : path.startsWith(link.href)
                  )
                    ? "page"
                    : undefined
                }
                className={cn(
                  "nav-link",
                  (link.href === "/"
                    ? path === "/" || path.startsWith("/briefing/")
                    : path.startsWith(link.href)) && "active",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="hidden gap-3 text-xs sm:inline-flex"
              onClick={() => setSearch(true)}
              aria-label="Search briefings"
            >
              <Search className="!size-3.5" />
              <span className="hidden lg:inline">Search briefings</span>
              <kbd className="hidden rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-muted-foreground lg:inline-flex">
                <Command className="!size-2.5" />K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => setSearch(true)}
              aria-label="Search briefings"
            >
              <Search />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobile((v) => !v)}
              aria-label={mobile ? "Close navigation" : "Open navigation"}
              aria-expanded={mobile}
            >
              {mobile ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {mobile && (
          <nav
            aria-label="Mobile navigation"
            className="site-container flex flex-col gap-1 border-t border-border py-4 md:hidden"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setMobile(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <Dialog open={search} onOpenChange={setSearch}>
        <DialogContent>
          <DialogTitle className="text-lg font-medium">Find your signal</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Search published editions by topic, headline, or date.
          </DialogDescription>
          <div className="relative my-5">
            <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <input
              aria-label="Search published editions"
              placeholder="Models, open source, 2025-04…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 w-full rounded-md border border-border bg-background pl-10 pr-3 text-sm outline-none focus:border-signal"
            />
          </div>
          <div aria-live="polite" className="space-y-1">
            {failed ? (
              <p className="py-6 text-sm text-muted-foreground">
                Search is temporarily unavailable.{" "}
                <Link href="/archive" onClick={() => setSearch(false)} className="text-signal">
                  Browse the archive
                </Link>
                .
              </p>
            ) : items === null ? (
              <p className="py-6 text-sm text-muted-foreground">Loading editions…</p>
            ) : !results.length ? (
              <p className="py-6 text-sm text-muted-foreground">
                No editions found. Try a different topic or date.
              </p>
            ) : (
              results.map((item) => (
                <Link
                  href={`/briefing/${item.date}`}
                  key={item.date}
                  onClick={() => setSearch(false)}
                  className="group flex items-center justify-between gap-5 rounded-md p-3 transition-colors hover:bg-accent"
                >
                  <div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {item.date}
                      {item.sample
                        ? item.sampleKind === "source-snapshot"
                          ? " · SOURCE SNAPSHOT"
                          : " · SAMPLE EDITION"
                        : ""}
                    </span>
                    <p className="mt-1 text-sm">{item.title}</p>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground group-hover:text-signal" />
                </Link>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
