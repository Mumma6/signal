import "server-only";
export function canonicalUrl(input: string) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Invalid article URL");
  // No local addresses in public source links. These are links only, never fetched.
  if (
    url.hostname === "localhost" ||
    !url.hostname.includes(".") ||
    /^[\d.:\[\]]+$/.test(url.hostname)
  )
    throw new Error("Non-public article URL");
  url.hash = "";
  for (const key of [...url.searchParams.keys()])
    if (/^(utm_.+|fbclid|gclid|ref)$/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/$/, "") || "/";
  return url.toString();
}
