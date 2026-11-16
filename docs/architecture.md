# Architecture and operations

Signal runs entirely inside the Next.js application. Server Components read published editions from PostgreSQL through Drizzle and `pg`. The pool is initialized lazily, uses a pooled Neon URL, limits connections to four, and attaches to Vercel Fluid compute's pool lifecycle when deployed. Build and sample preview do not require database access.

Client components handle interaction, rather than fetching core briefing content. Search uses a public, bounded edition index. Archive queries return the latest 366 editions; search currently searches edition titles and descriptions, rather than all article bodies. The RSS feed contains stories from the latest published edition, with links to their original sources. Fonts and artwork are served locally.

## Publication state

An edition date is the concurrency key. A single `INSERT ... ON CONFLICT ... WHERE` atomically acquires a five-minute lease only if the edition is unpublished and its lease is absent or expired. Each invocation has a random fencing token (`run_id`). An already-published date returns immediately.

The runner persists these checkpoints:

1. **evaluate**: normalized candidate text, source reports, GitHub snapshot, and collection counters.
2. **summarize**: selected articles, recurring themes, and completed, validated source excerpts. The phase name is retained for checkpoint compatibility.
3. **publish**: the ordered stories ready for the publication transaction.

Checkpoints renew the lease. Writes require the current fencing token. Publication locks the briefing row before inserting articles and joins, then marks it published in the same transaction. Each story retains an immutable source snapshot, so corrections to the same URL in a later edition cannot change an earlier edition’s source text or attribution. A stale worker cannot publish after another invocation takes ownership. A process killed before releasing its lease becomes recoverable when that lease expires. Published editions clear their checkpoints and never expose unfinished work.

The invocation budget is 220 seconds within a 300-second Vercel function. Collection requests time out after 12 seconds and are limited to 2 MB each. News collection uses at most four concurrent requests. GitHub makes three sequential searches, then up to six stable-release requests with concurrency three. Curation and grouping are local CPU work with no inference APIs. Excerpt extraction runs in batches of three; each completed batch is saved. The runner requires five seconds of remaining budget before a processing stage, releases its lease, and returns `pending` if there is insufficient time. It does not start detached background work after returning a response.

The 08:00 UTC recovery cron resumes the same date. The CLI continues pending stages for up to four invocations, then exits with a clear pending message. Neither Vercel nor the application assumes that a failed HTTP request will automatically be retried. Monitor failed and pending results; rerun the CLI for further attempts. A saved older date can be resumed explicitly. An older date without a checkpoint cannot start a new collection from today's feeds.

## Failure behavior

- **One news source fails:** mark it unavailable; continue with the others.
- **A source returns no usable items:** record a successful execution with zero collected; don't label an empty but functioning feed as unavailable.
- **GitHub fails:** publish supported stories and omit unavailable repository snapshots. Missing release data is recorded separately from failed repository metadata. A release endpoint's 404 means no release, rather than failed collection.
- **Evaluation fails or selects no stories:** leave the edition unpublished. Keep the collected snapshot for a safe retry.
- **Some excerpts fail:** publish only validated source excerpts and mark the edition partial.
- **All excerpts fail:** retain progress without publishing. A later invocation retries extraction.
- **Database publication fails:** roll back articles, ordered joins, and publication state together. The previous edition remains readable.
- **Telemetry fails:** swallow telemetry errors; preserve application results and original errors.
- **A configured database is unavailable:** show the recovery screen, rather than substituting sample news.

Errors persisted in `last_error` and returned to HTTP callers are deliberately generic. Upstream response bodies and credentials must never enter public responses or database error messages. Vercel logs contain process names, durations, and numeric business outcomes, rather than raw source bodies.

## Editorial limits

Signal is provider-free. It uses no model SDK, model credentials, LLM inference, or generated analysis. Source excerpts come from feeds, APIs, and the two explicitly configured official index-page readers. Some feeds publish short descriptions, so coverage is deliberately narrower than a full-text service. arXiv abstracts and vendor posts remain author claims. A rolling 48-hour window allows delayed or quiet-day coverage; consecutive editions may include the same development within that window. A quiet vendor feed is recorded as successful with zero fresh stories, not padded with older news.

URL/title normalization handles exact duplicates. Headline token similarity handles close wording but cannot reliably infer semantic equivalence. Explicit software version numbers prevent two releases being merged. Relevance uses transparent, bounded keyword and provenance rules. Candidates are capped at four per publisher; publication at two per publisher and one per CLI release feed. “From the source” is an exact excerpt of up to 25 words, while “Why it’s here” is a factual selection-context template. It is never presented as an authored analysis of significance. Previously generated archived content keeps its legacy provenance label.

Themes use a separate seven-day context window from the same feed responses, while news cards retain a 48-hour window. Context candidates are deduplicated and balanced with the same publisher quotas. Themes are recurring two- and three-word phrases in relevant, nonduplicate developments from at least two publisher groups. At least one supporting headline must contain the phrase. Simple plural normalization groups variants; stopwords and overlapping phrase groups reduce noise. Multiple feeds from one company count as one group. Phrases come from the actual collection, rather than a fixed trend taxonomy. Counts describe collected evidence, not internet-wide popularity, acceleration, or consensus. Missing shared phrasing produces no theme; it is never filled with invented trends.

GitHub Radar searches `llm`, `ai-agents`, and `machine-learning` topics for repositories created within 90 days and pushed within 14 days. Eligibility checks exclude old, inactive, unlicensed, forked, mirrored, archived, template, and common list repositories, and require a language, useful technical description, and size above 10 KB. Selection balances at most two per topic and one per owner, ordered by creation date within each topic. Stars are display context only. Latest stable releases are collected for at most six results. Search failures and incomplete responses are reported as partial coverage. No qualified projects is a legitimate empty result, not a reason to substitute familiar old repositories. The procedure is a discovery heuristic, not a code-quality or security review.

The local preview command writes a dated, public-data-only snapshot to `src/lib/preview.json`. It needs neither a database nor a model account. Page requests read this checked-in snapshot when no database is configured, and do not call upstreams. The command leaves the prior snapshot intact if no readable stories are available.

## Schema changes

Change `src/lib/db/schema.ts`, generate with `npm run db:generate`, review the SQL, and commit the migration and snapshot together. Test on an isolated Neon branch before production. Use a direct connection for migration, and an additive migration for existing data. Do not run `drizzle-kit push` against production or run migrations implicitly during deployments. Removing or altering constraints requires a deliberate data migration.

The migrations are exercised locally by the PostgreSQL contract tests. PGlite validates PostgreSQL SQL behavior but cannot reproduce Neon networking, PgBouncer behavior, or true multi-process contention. A real Neon branch test remains a deployment check. No model smoke test or AI-provider setup is required.

## Security

The public application is read-only. Both generation routes require a timing-safe comparison of a minimum 32-character bearer secret. Unset credentials never authorize a request. There are no client-side credentials, user submissions, open proxy routes, or URL-based generation secrets. Collectors fetch explicit endpoints and reject redirects. GitHub repository names are validated before constructing release URLs on the fixed API host. Article URLs are validated links, never crawl targets. XML entity declarations are rejected before parsing; only built-in XML entities are decoded. HTML is parsed with scripts/styles removed, responses are bounded, and external text is rendered through React escaping. The official-page adapters are narrow and fail visibly on markup changes; robots policies were checked before enabling them.

Responses include frame denial, MIME sniffing protection, a restrictive permissions policy, a referrer policy, and CSP. Next.js requires inline hydration scripts; `unsafe-inline` is allowed for scripts/styles. `unsafe-eval` is allowed only in development for React debugging. There are no arbitrary script or tracking origins. The production host supplies HTTPS. Keep application and migration credentials isolated by environment and apply the provider's least-privilege configuration.
