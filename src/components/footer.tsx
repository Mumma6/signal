import Link from "next/link";
import { Rss, ArrowUpRight } from "lucide-react";
import { SignalWordmark } from "./brand";
export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="site-container flex flex-col justify-between gap-8 py-10 sm:flex-row sm:items-center">
        <div>
          <Link href="/" aria-label="Signal home">
            <SignalWordmark />
          </Link>
          <p className="mt-2 text-xs text-muted-foreground">A little perspective. Every day.</p>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
          <Link href="/about" className="hover:text-foreground">
            Our approach
          </Link>
          <Link href="/archive" className="hover:text-foreground">
            The archive
          </Link>
          <a href="/feed.xml" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <Rss className="size-3" /> RSS feed
            <ArrowUpRight className="size-3" />
          </a>
          <span className="hidden h-3 w-px bg-border sm:block" />
          <span>Independent. Always curious.</span>
        </div>
      </div>
    </footer>
  );
}
