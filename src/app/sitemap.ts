import type { MetadataRoute } from "next";
import { listEditions } from "@/lib/editions";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const editions = await listEditions();
  return ["", "/radar", "/archive", "/about", ...editions.map((e) => `/briefing/${e.date}`)].map(
    (path) => ({
      url: `${base}${path}`,
      changeFrequency: path === "" ? "daily" : "weekly",
      priority: path === "" ? 1 : 0.6,
    }),
  );
}
