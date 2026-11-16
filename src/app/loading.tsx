export default function Loading() {
  return (
    <div role="status" aria-label="Loading Signal" className="site-container animate-pulse py-16">
      <div className="h-3 w-44 rounded bg-muted" />
      <div className="mt-8 h-14 w-3/4 max-w-lg rounded bg-muted" />
      <div className="mt-4 h-14 w-2/3 max-w-md rounded bg-muted" />
      <div className="mt-8 h-4 w-60 rounded bg-muted" />
      <div className="mt-16 h-px bg-muted" />
      <div className="mt-10 grid gap-7 md:grid-cols-[2fr_1fr]">
        <div className="h-[480px] rounded-xl bg-muted/50" />
        <div className="h-80 rounded-xl bg-muted/50" />
      </div>
      <span className="sr-only">Loading your briefing…</span>
    </div>
  );
}
