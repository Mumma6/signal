import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEdition } from "@/lib/editions";
import { validDate } from "@/lib/pipeline/run";
import { Briefing } from "@/components/briefing";
import { formatDate } from "@/lib/utils";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ date: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  if (!validDate(date)) return { title: "Edition not found" };
  const edition = await getEdition(date);
  return {
    title: edition
      ? `${formatDate(date)}${edition.sample ? (edition.sampleKind === "source-snapshot" ? " · Source snapshot" : " · Sample edition") : ""}`
      : "Edition not found",
    description: edition?.description,
    alternates: { canonical: `/briefing/${date}` },
  };
}
export default async function EditionPage({ params }: Props) {
  const { date } = await params;
  if (!validDate(date)) notFound();
  const edition = await getEdition(date);
  if (!edition) notFound();
  return <Briefing edition={edition} archive />;
}
