import { getLatestEdition } from "@/lib/editions";
import { editionFeed } from "@/lib/http/feed";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const edition = await getLatestEdition();
    return new Response(
      editionFeed(edition, process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
      {
        headers: {
          "Content-Type": "application/rss+xml; charset=utf-8",
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return Response.json({ error: "The feed is temporarily unavailable" }, { status: 503 });
  }
}
