"use client";
import { Button } from "@/components/ui/button";
import { SignalMark } from "@/components/brand";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="site-container flex min-h-[65vh] flex-col items-center justify-center py-20 text-center">
      <SignalMark className="mb-7 size-10 text-signal" />
      <span className="eyebrow text-signal">A BRIEF INTERRUPTION</span>
      <h1 className="mt-5 text-3xl tracking-tight">The signal is a little quiet.</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
        We couldn’t load this edition. Your next briefing is worth waiting for. Please try again in
        a moment.
      </p>
      <Button onClick={reset} className="mt-7" variant="outline">
        Try again
      </Button>
    </main>
  );
}
