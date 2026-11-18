import Link from "next/link";
import { SignalMark } from "./layout/brand";
import { Button } from "./ui/button";
export function EmptyState() {
  return (
    <main className="site-container flex min-h-[65vh] flex-col items-center justify-center py-20 text-center">
      <SignalMark className="mb-8 size-10 text-signal" />
      <span className="eyebrow text-signal">A LITTLE PERSPECTIVE. COMING SOON.</span>
      <h1 className="mt-5 text-4xl font-normal tracking-tight">The first signal is on its way.</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
        We’re gathering the developments that deserve your attention. Check back for the first daily
        briefing.
      </p>
      <Button asChild variant="outline" className="mt-7">
        <Link href="/about">Get to know Signal</Link>
      </Button>
    </main>
  );
}
