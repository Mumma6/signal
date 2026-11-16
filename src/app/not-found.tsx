import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main className="site-container flex min-h-[65vh] flex-col items-center justify-center py-20 text-center">
      <span className="eyebrow text-signal">404 / SIGNAL NOT FOUND</span>
      <h1 className="mt-5 text-3xl tracking-tight">Nothing on this frequency.</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        That edition or page isn’t available. There’s more to discover in the latest briefing.
      </p>
      <Button asChild variant="outline" className="mt-7">
        <Link href="/">Back to the briefing</Link>
      </Button>
    </main>
  );
}
