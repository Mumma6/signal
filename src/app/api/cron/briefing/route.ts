import { authorizedCron } from "@/lib/http/cron";
import { generateBriefing } from "@/lib/pipeline";
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!authorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await generateBriefing();
    return Response.json(result, {
      status: result.status === "pending" || result.status === "busy" ? 202 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Briefing generation failed. Retrying is safe; saved progress is retained." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }
}
