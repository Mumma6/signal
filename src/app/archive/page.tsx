import type { Metadata } from "next";
import { listEditions } from "@/lib/editions";
import { ArchiveList } from "@/components/archive-list";
export const metadata: Metadata = {
  title: "The archive",
  description: "Revisit past editions of Signal’s daily AI briefing.",
};
export const dynamic = "force-dynamic";
export default async function ArchivePage() {
  const editions = await listEditions();
  return (
    <main className="site-container">
      <section className="page-intro">
        <span className="eyebrow text-signal">THE SIGNAL ARCHIVE</span>
        <h1>Good context doesn’t expire.</h1>
        <p>
          Every edition, in one place. Revisit the releases, ideas, and turning points that are
          shaping AI.
        </p>
      </section>
      <ArchiveList editions={editions} />
    </main>
  );
}
