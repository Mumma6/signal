import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" },
) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(
    new Date(`${date.slice(0, 10)}T12:00:00Z`),
  );
}
export function readingMinutes(stories: { summary: string; whyItMatters: string }[]) {
  return Math.max(
    1,
    Math.ceil(
      stories.reduce((n, s) => n + `${s.summary} ${s.whyItMatters}`.split(/\s+/).length, 0) / 180,
    ),
  );
}
