import { ArrowUpRight, GitFork, Star, GitCommitHorizontal, Tag } from "lucide-react";
import type { Repository } from "@/lib/types";
import { formatDate } from "@/lib/utils";
export function RadarCard({ repo, compact = false }: { repo: Repository; compact?: boolean }) {
  const [owner, name] = repo.name.split("/");
  return (
    <article className={compact ? "radar-mini" : "radar-card"}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <GitFork className="size-4 shrink-0 text-muted-foreground" />
          <a
            href={repo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-mono text-[13px] transition-colors hover:text-signal"
          >
            <span className="text-muted-foreground">{owner}/</span>
            {name}
          </a>
        </div>
        <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        {compact ? repo.description : repo.reason}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
        {repo.language && (
          <span className="flex items-center gap-1.5">
            <i
              className={`size-1.5 rounded-full ${repo.language === "Go" ? "bg-cyan-300" : repo.language === "C++" ? "bg-pink-300" : "bg-blue-300"}`}
            />
            {repo.language}
          </span>
        )}
        {repo.stars !== null && (
          <span
            className="flex items-center gap-1.5"
            title="Total stars at collection time; context, not an endorsement"
          >
            <Star className="size-3" />
            {new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
              repo.stars,
            )}
          </span>
        )}
        {compact && repo.stars === null && <span>Discovery snapshot</span>}
        {repo.license && <span>{repo.license}</span>}
      </div>
      {!compact && (
        <div className="mt-6 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
          {repo.createdAt && (
            <p className="flex items-center gap-2">
              <Tag className="size-3.5" />
              Created {formatDate(repo.createdAt)}
            </p>
          )}
          <p className="flex items-center gap-2">
            <GitCommitHorizontal className="size-3.5" />
            {repo.pushedAt
              ? `Last push ${formatDate(repo.pushedAt)}`
              : "Activity available after first live collection"}
          </p>
          <p className="flex items-center gap-2">
            <Tag className="size-3.5" />
            {repo.release && repo.releaseUrl ? (
              <a
                href={repo.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-signal"
              >
                Latest release: {repo.release} ↗
              </a>
            ) : (
              "No release data in this snapshot"
            )}
          </p>
        </div>
      )}
    </article>
  );
}
