import "server-only";
import { load } from "cheerio";

export type RawArticle = { title: unknown; url: unknown; content: unknown; publishedAt: unknown };
const months =
  "January February March April May June July August September October November December".split(
    " ",
  );
const datePattern =
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/;

function dated(value: string): string | null {
  const match = value.match(datePattern)?.[0];
  if (!match) return null;
  const timestamp = Date.parse(`${match} 00:00:00 GMT`);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function parseAnthropic(html: string): RawArticle[] {
  const $ = load(html);
  $("script,style,nav,footer").remove();
  const rows: RawArticle[] = [];
  // Titles, descriptions and dates are already published on the newsroom index.
  $("h2,h3").each((_, heading) => {
    const title = $(heading).text().trim();
    const link = $(heading).closest("a[href]");
    if (!link.length) return;
    const href = link.attr("href");
    if (!href?.startsWith("/") || href.startsWith("//")) return;
    let container = link.parent();
    for (let depth = 0; depth < 4 && container.length; depth++, container = container.parent()) {
      // Never borrow a date from an enclosing page or a different story.
      if (container.find("h2,h3").length !== 1) continue;
      const time = container.find("time").first();
      const publishedAt = dated(time.text());
      const content = container.find("p").first().text().trim();
      if (publishedAt && content) {
        rows.push({
          title,
          content,
          publishedAt,
          url: new URL(href, "https://www.anthropic.com").href,
        });
        break;
      }
    }
  });
  if (!rows.length)
    throw new Error("Anthropic newsroom markup no longer matches the dated-story parser");
  return [...new Map(rows.map((row) => [row.url, row])).values()].slice(0, 20);
}

export function parseXaiNotes(html: string): RawArticle[] {
  const $ = load(html);
  $("script,style,nav,footer").remove();
  const sections = $("h2")
    .toArray()
    .map((el) => ({ el, text: $(el).text().trim() }));
  const headings = $("h2,h3").toArray();
  const rows: RawArticle[] = [];
  $("h3[id]").each((_, heading) => {
    const title = $(heading).text().trim();
    const body = $(heading).parent().parent();
    const entry = body.parent();
    if (body.find("h3").length !== 1 || entry.find("h3").length !== 1) return;
    const dateLabel = entry.children().first().text().trim();
    const monthName = dateLabel.match(/^[A-Za-z]+/)?.[0];
    const day = dateLabel.match(/\b\d{1,2}\b/)?.[0];
    const month = months.indexOf(monthName ?? "");
    if (month < 0 || !day) return;
    const previousSection = headings
      .slice(0, headings.indexOf(heading))
      .reverse()
      .find((el) => el.tagName === "h2");
    const sectionIndex = sections.findIndex((s) => s.el === previousSection);
    if (sectionIndex < 0) return;
    let year = sections[sectionIndex].text.match(/\b(20\d{2})\b/)?.[1];
    if (!year) {
      // The current-year month labels omit the year. Infer it only from a dated
      // older section on this same page, never from the wall clock.
      const anchor = sections.slice(sectionIndex + 1).find((s) => /\b20\d{2}\b/.test(s.text));
      if (!anchor) return;
      const anchorYear = Number(anchor.text.match(/\b20\d{2}\b/)![0]);
      const anchorMonth = months.findIndex((m) => anchor.text.startsWith(m));
      year = String(anchorYear + (month < anchorMonth ? 1 : 0));
    }
    const publishedAt = dated(`${monthName} ${day}, ${year}`);
    const content = body
      .find("p,li")
      .map((_, el) => $(el).text())
      .get()
      .join(" ")
      .trim();
    const section = $(heading).attr("id")!;
    if (publishedAt && content)
      rows.push({
        title,
        content,
        publishedAt,
        url: `https://docs.x.ai/developers/release-notes?section=${encodeURIComponent(section)}`,
      });
  });
  if (!rows.length)
    throw new Error("xAI release notes markup no longer matches the dated-entry parser");
  return rows.slice(0, 20);
}
