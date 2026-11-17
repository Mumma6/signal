import "server-only";
export class SourceHttpError extends Error {
  constructor(readonly status: number) {
    super(`Source returned HTTP ${status}`);
    this.name = "SourceHttpError";
  }
}
// Only explicit, first-party API/feed/index endpoints are fetched. Article URLs are never crawled.
export async function fetchText(
  url: string,
  headers: Record<string, string> = {},
  timeout = 12000,
) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Signal/1.0 (AI daily briefing; feed reader)", ...headers },
    signal: AbortSignal.timeout(timeout),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) throw new SourceHttpError(response.status);
  const limit = 2_000_000;
  if (Number(response.headers.get("content-length")) > limit)
    throw new Error("Source response too large");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty source response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Source response too large");
      chunks.push(value);
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Cancellation is cleanup; it must not mask the read/size failure.
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}
