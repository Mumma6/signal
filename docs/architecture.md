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
- **Evaluation fails:** leave the edition unpublished and retain the snapshot for a safe retry.
- **No unseen story qualifies:** return `no-new-stories`, release the lease, and clear the empty checkpoint. Keep the previous dated edition readable; the recovery cron can collect later arrivals.
- **Some excerpts fail:** publish only validated source excerpts and mark the edition partial.
- **All excerpts fail:** retain progress without publishing. A later invocation retries extraction.
- **Database publication fails:** roll back articles, ordered joins, and publication state together. The previous edition remains readable.
- **A configured database is unavailable:** show the recovery screen, rather than substituting sample news.

Errors persisted in `last_error` and returned to HTTP callers are deliberately generic. Upstream response bodies and credentials must never enter public responses or database error messages. Cron responses and saved editions contain numeric business outcomes; raw source bodies and credentials are never included in public errors.

## Editorial limits

Signal is provider-free. It uses no model SDK, model credentials, LLM inference, or generated analysis. Source excerpts come from feeds, APIs, and the two explicitly configured official index-page readers. Some feeds publish short descriptions, so coverage is deliberately narrower than a full-text service. arXiv abstracts and vendor posts remain author claims. A rolling 48-hour window allows delayed or quiet-day coverage; a 30-day published-story history is checked before candidate quotas, so previously featured URLs and close headline matches are excluded. History reads select only IDs, URLs, titles, and source IDs, and fail closed. Saved checkpoints are rechecked on resume. Different software versions remain eligible when their source URLs differ. A quiet vendor feed is recorded as successful with zero fresh stories, not padded with older news.

URL/title normalization handles exact duplicates. Headline token similarity handles close wording but cannot reliably infer semantic equivalence. Explicit software version numbers prevent two releases being merged. Relevance uses transparent, bounded keyword and provenance rules. Candidates are capped at four per publisher; publication at two per publisher and one per CLI release feed. “From the source” is an exact excerpt of up to 25 words, while “Why it’s here” is a factual selection-context template. It is never presented as an authored analysis of significance. Previously generated archived content keeps its legacy provenance label.

Themes use a separate seven-day context window from the same feed responses, while news cards retain a 48-hour window. Context candidates are deduplicated and balanced with the same publisher quotas. Themes are recurring two- and three-word phrases in relevant, nonduplicate developments from at least two publisher groups. At least one supporting headline must contain the phrase. Simple plural normalization groups variants; stopwords and overlapping phrase groups reduce noise. Multiple feeds from one company count as one group. Phrases come from the actual collection, rather than a fixed trend taxonomy. Counts describe collected evidence, not internet-wide popularity, acceleration, or consensus. Missing shared phrasing produces no theme; it is never filled with invented trends.

GitHub Radar searches `llm`, `ai-agents`, and `machine-learning` topics for repositories with at least 1,000 stars and a push within 14 days. Established repositories are eligible: freshness comes from activity and release dates, rather than repository creation. Eligibility excludes inactive, unlicensed, forked, mirrored, archived, template, and common list repositories, and requires a language, technical description, and size above 10 KB. Selection balances at most two per topic and one per owner, ordered by recent push. Stars are a popularity threshold, not a quality assessment. Latest stable releases are collected for at most six results. Search failures and incomplete responses are reported as partial coverage. Empty results are never padded. The explicit `radar:refresh` command can replace today's published repository metadata after a complete collection; news and historical editions stay unchanged.

The local preview command writes a dated, public-data-only snapshot to `src/lib/preview/snapshot.json`. It needs neither a database nor a model account. Page requests read this checked-in snapshot when no database is configured, and do not call upstreams. The command leaves the prior snapshot intact if no readable stories are available.

## Schema changes

Change `src/lib/db/schema.ts`, generate with `npm run db:generate`, review the SQL, and commit the migration and snapshot together. Test on an isolated Neon branch before production. Use a direct connection for migration, and an additive migration for existing data. Do not run `drizzle-kit push` against production or run migrations implicitly during deployments. Removing or altering constraints requires a deliberate data migration.

The migrations are exercised locally by the PostgreSQL contract tests. PGlite validates PostgreSQL SQL behavior but cannot reproduce Neon networking, PgBouncer behavior, or true multi-process contention. A real Neon branch test remains a deployment check. No model smoke test or AI-provider setup is required.

## Security

The public application is read-only. Both generation routes require a timing-safe comparison of a minimum 32-character bearer secret. Unset credentials never authorize a request. There are no client-side credentials, user submissions, open proxy routes, or URL-based generation secrets. Collectors fetch explicit endpoints and reject redirects. GitHub repository names are validated before constructing release URLs on the fixed API host. Article URLs are validated links, never crawl targets. XML entity declarations are rejected before parsing; only built-in XML entities are decoded. HTML is parsed with scripts/styles removed, responses are bounded, and external text is rendered through React escaping. The official-page adapters are narrow and fail visibly on markup changes; robots policies were checked before enabling them.

Responses include frame denial, MIME sniffing protection, a restrictive permissions policy, a referrer policy, and CSP. Next.js requires inline hydration scripts; `unsafe-inline` is allowed for scripts/styles. `unsafe-eval` is allowed only in development for React debugging. There are no arbitrary script or tracking origins. The production host supplies HTTPS. Keep application and migration credentials isolated by environment and apply the provider's least-privilege configuration.

Explicit owner corrections use `briefing:revise`: a dry run by default, then an apply command with a mandatory local backup. Only today’s edition is eligible. The transaction locks the published row, checks the reviewed publication timestamp, replaces joins, and calls the shared publication operation inside the existing transaction. A failed correction rolls back to the original edition. Scheduled execution never revises a published date.

## Module ownership

- `editorial/` owns pure rules: candidate preparation, relevance, selection, novelty, source excerpts, themes, and edition copy. It reads explicit inputs and immutable publisher metadata; it does not import PostgreSQL, React, environment variables, HTTP clients, or workflow code. Candidate preparation is shared by the cron runner, preview command, and correction command.
- `pipeline/` owns the application process. `run.ts` sequences I/O and checkpoints; `progress.ts` implements immutable state transitions. `index.ts` is the composition root that supplies actual collectors and the PostgreSQL store.
- `sources/` owns RSS/Atom, official-page, Hacker News, and GitHub transport/parsing. `SourceHttpError.status` distinguishes a normal missing GitHub release from an unavailable provider. Workers return release-failure metadata; aggregation does not use a shared mutable counter.
- `db/` owns Drizzle and PostgreSQL operations. `briefing-store.ts` implements leases and saved progress; `publication.ts` is the shared transaction operation; `revise.ts` performs explicit owner corrections; `edition-reader.ts` hydrates validated published models. A transaction is passed as a small structural `DatabaseSession`, with no production driver assertions or nested store construction.
- `editions.ts` composes the reader with preview policy and React request memoization. Neither the reader nor editorial rules knows about preview mode.
- `schemas.ts` defines serialized model validation. `types.ts` derives TypeScript types from those schemas. `pipeline/checkpoint.ts` retains deployed checkpoint phase names and optional legacy fields. The client-safe search index uses `presentation.ts`. Local snapshots, CLI collection inputs, database checkpoints, and hydrated editions are validated against server-only schemas.

UI components are grouped by layout, briefing, archive, radar, and shared Radix primitives. `preview/` keeps the validated sample reader beside its checked-in source snapshot. `http/` contains cron authorization and RSS serialization. Maintenance scripts are grouped under `scripts/briefing`, `scripts/db`, and `scripts/sources`; npm command names and explicit server conditions remain the entry points. Tests mirror the backend responsibilities, with reusable fixtures and the marker alias under `tests/support`.

The PostgreSQL pool is an intentional process-local singleton so requests reuse connections. Other mutable state is scoped to an invocation or local algorithm; checkpoint transitions return new values instead of editing persisted inputs. Small bounded loops and maps remain where they clarify ranking and collection.

## Error ownership

A quiet-day outcome, a missing stable release, and a failed integration are different results. Public cron/API errors remain generic and exclude source payloads and credentials. A failed lease release cannot replace the processing error; expiry still permits recovery. A malformed saved checkpoint fails closed, retains the original JSON for diagnosis, and releases the newly acquired lease. Database drivers are only asserted in the PGlite test harness, where two Drizzle drivers execute the same SQL contracts.

## Remaining limits

Headline similarity remains lexical, and selection rules cannot judge all editorial nuance. Search indexes edition metadata rather than full article bodies. The database JSON column layout and legacy `summarize`/`ai` labels are retained for compatibility; changing them would need an explicit migration. No model provider is connected. These limits are intentional and separate from module organization.

## Enforced execution boundary

Next.js `server-only` markers protect domain processing, workflows, collectors, persistence, and server read services. `editorial/editor.ts` provides the local async editor contract directly. The scheduled runner and explicit correction path retain their existing leases, outcomes, source-failure isolation, and transaction semantics.

The browser imports UI components, presentation formatting helpers, `presentation.ts`, and type-only contracts. Its fetch goes to the existing `/api/editions` endpoint, not upstream providers. Server pages call edition services directly and map the result to `BriefingView` before crossing the serialization boundary. Source reports, generation counters, and checkpoints are not reader props. Repository and source-link data is intentionally public presentation content.

CLI scripts load protected server modules with `--conditions=react-server`; npm commands include that flag. Unit tests run the business modules in Node with a test-only marker alias. Boundary tests traverse transitive imports from every Client Component and check the actual marker's Node conditions. Production builds enforce the real Next.js boundary. No HTTP endpoints, schema migrations, or deployment schedules were added.
