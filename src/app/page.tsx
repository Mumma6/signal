import { Briefing } from "@/components/briefing";
import { getLatestEdition } from "@/lib/editions";
import { EmptyState } from "@/components/empty-state";
export const dynamic = "force-dynamic";
export default async function Home() {
  const edition = await getLatestEdition();
  return edition ? (
    <Briefing
      key={edition.id}
      edition={edition}
      stale={!edition.sample && edition.date !== new Date().toISOString().slice(0, 10)}
    />
  ) : (
    <EmptyState />
  );
}
