# Signal

**Stay ahead of AI. Without the noise.**

[Read Signal →](https://signal-gold-five.vercel.app) · [Source on GitHub](https://github.com/Mumma6/signal) · [CI](https://github.com/Mumma6/signal/actions/workflows/ci.yml)

Signal is an independent daily AI briefing for developers and curious technologists. It pairs short, attributed source excerpts with transparent selection context, recurring themes, and popular, actively maintained open-source projects. **All curation runs locally. No OpenAI account, model API, inference service, or model key is needed.**

The interface is built for reading: self-hosted Geist typography, a charcoal and muted-blue palette, original wave artwork, a focused one-story reader with Next/Previous controls, source notes, keyboard-accessible search, an archive, and RSS. There are no accounts, personalization services, or advertising trackers.

## Run locally

Use Node.js 24 LTS (or Node.js 22.12+) and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000). **No credentials are needed to explore the application.** Without `DATABASE_URL`, it shows a clearly labeled, dated snapshot of real source excerpts and GitHub discoveries. It never disguises the capture date or fabricates metrics. A historical fallback is retained for development.

Refresh the local snapshot at any time without a database or model account:

```sh
npm run preview:refresh
```

This reads the configured public sources and writes `src/lib/preview.json`. It does not publish an edition or change a database. The checked-in snapshot is fixed until refreshed; web requests do not trigger upstream API calls.

With a configured database, an empty database shows a first-edition state; a database outage shows the recovery screen. Sample data is never substituted for unavailable production data.

## Enable live briefings

1. Supply a pooled Neon PostgreSQL connection as `DATABASE_URL` and its direct connection as `DATABASE_URL_UNPOOLED` in `.env.local`. Signal does not provision a database automatically.
2. Set `CRON_SECRET` to at least 32 random characters. Generate one with `openssl rand -hex 32`.
3. Apply the checked-in migrations, then generate the first edition:

```sh
npm run db:migrate
npm run sources:check
npm run briefing:generate
```

Refresh the homepage. Subsequent invocations for that UTC date return `already-published`. Published stories are immutable through the scheduled pipeline. An explicit owner maintenance command can revise today's edition after a dry run, with a required backup; see below. The explicit `radar:refresh` maintenance command can replace only today's GitHub metadata after a complete collection; it never rewrites news or older editions.

### Environment

| Variable                | Purpose                                                     | Required                    |
| ----------------------- | ----------------------------------------------------------- | --------------------------- |
| `DATABASE_URL`          | Pooled Neon PostgreSQL URL for runtime reads and writes     | Live mode                   |
| `DATABASE_URL_UNPOOLED` | Direct PostgreSQL URL for explicit migrations               | Migrations                  |
| `CRON_SECRET`           | At least 32 random characters; protects both cron endpoints | HTTP generation             |
| `GITHUB_TOKEN`          | Optional read-only token to raise public GitHub API quotas  | Optional                    |
| `NEXT_PUBLIC_SITE_URL`  | Canonical origin, such as `https://signal.example`          | Production metadata and RSS |

Never expose database, GitHub, or cron credentials with `NEXT_PUBLIC_`. The local generation command loads `.env.local` and invokes the same pipeline directly; it doesn't bypass authentication on the HTTP route. There are no inference charges; hosting, database, and optional domain costs depend on your own plans and usage.

## Commands

```sh
npm run dev                 # Local preview with hot reload
npm run check               # TypeScript, ESLint, and automated tests
npm run build               # Optimized Next.js production build
npm start                   # Serve the production build
npm run format              # Format tracked application files
npm run format:check        # Check formatting
npm run sources:check       # Read-only source and GitHub checks; no database or AI required
npm run preview:refresh     # Refresh the dated local preview without any model or database
npm run db:generate         # Generate a migration after changing the schema
npm run db:migrate          # Apply checked-in migrations through the direct database URL
npm run briefing:generate   # Generate or resume today's UTC edition
npm run radar:refresh       # Explicitly refresh only today's published GitHub snapshot
npm run radar:refresh -- --preview # Update today's local radar snapshot instead
```

An optional date resumes a saved older run or returns an already-published edition:

```sh
npm run briefing:generate -- 2026-11-16
```

New collection is allowed only for today's UTC edition. The feeds expose recent items, so this command does **not** pretend to backfill historical dates. A resumed run retains its original collection snapshot.

## How publication works

The daily job collects bounded batches from 20 sources, listed in `src/lib/sources/registry.ts`: OpenAI, Codex releases, Anthropic, Claude Code releases, Cursor, xAI/Grok, Mistral, Gemini product and model feeds, DeepMind, Google Research, Hugging Face, NVIDIA, Microsoft Research, AWS Machine Learning, GitHub AI & ML, DEV's AI feed, Simon Willison, arXiv, and Hacker News. Feeds and APIs are preferred. Anthropic's newsroom and xAI's release notes have narrowly scoped readers for dated entries already present on their official index pages. No article links are crawled. Headline-only Hacker News submissions are excluded.

URLs are canonicalized and validated, markup is stripped, and malformed, future, stale, and insufficiently supported entries are rejected. Exact URL and normalized-title checks remove duplicates. Before publisher quotas are applied, a 30-day publication history excludes previously featured IDs, canonical URLs, identical headlines, and close rewordings of the same development. A history-read failure stops publication rather than allowing repeats. Up to 36 candidates are balanced across publishers from a rolling 48-hour window, with at most four per publisher. Each publisher's strongest candidates are retained before truncation, rather than simply its newest posts. Google’s multiple feeds share a quota, as do OpenAI/Codex and Anthropic/Claude Code. Feed collectors run at most four requests concurrently, with time and response-size bounds.

Local rules emphasize concrete announcements, technical headline evidence, and practical engineering content. Keyword-heavy customer case studies and partnership announcements are below the publication threshold. Freshness breaks relevance ties, and successive picks receive a diversity penalty for repeating a publisher or category. Rules classify stories and use normalized headline similarity to group overlapping developments. Distinct software version numbers remain separate. At most six stories are selected, with no more than two per publisher and one per CLI-release feed. Cards contain up to 25 words copied from the source, labeled “From the source,” plus “Why it’s here” selection context. Original headlines, dates, URLs, and attribution are preserved. Zod and exact-substring checks validate excerpts. No prose is generated by a model. Six is a maximum, not a quota: a quiet day produces fewer stories. If no unseen story qualifies, the runner returns `no-new-stories`, leaves the previous dated edition available, and clears the empty checkpoint so the later recovery cron can collect new arrivals.

“In the conversation” discovers recurring two- and three-word phrases across relevant, nonduplicate developments from at least two independent publisher groups. It uses the last seven days of material from the same feed reads, while news cards stay within 48 hours. A phrase must also appear in a headline. There is no hardcoded list of fashionable topics; the same vendor's feeds count as one voice. Counts describe this collection, rather than internet-wide popularity. The section is omitted when evidence is insufficient. Keyword rules can miss nuance or synonyms; original-source claims are not independent verification.

GitHub Radar searches LLM, AI-agent, and machine-learning topics for projects with **at least 1,000 stars** and a push within 14 days. There is no creation-date cutoff: established projects can have important new releases. A declared license, code language, technical description, and nontrivial repository size are required. Forks, mirrors, templates, archived repositories, and common link lists are excluded. Up to six discoveries are balanced across topics and owners, ordered by recent push within each topic. Stars establish popularity, not code quality. Latest stable release tags and dates are fetched for selected projects. Every card preserves its collection timestamp.

The database stores four entities: `sources`, `articles`, `briefings`, and `briefing_articles`. A briefing row also holds recurring themes, the GitHub snapshot, source results, business outcomes, and unpublished progress. Publication inserts source articles and ordered excerpts in one transaction. Each story retains its immutable source snapshot and content-provenance label. Existing legacy summaries retain their original label. Unique date, article URL, article membership, and position constraints prevent duplicate publication.

See [architecture and operational details](docs/architecture.md) for leases, recovery, and error handling.

## Deploy to Vercel

The public application runs on [Vercel](https://signal-gold-five.vercel.app), backed by Neon PostgreSQL in Frankfurt. Production and development use separate database branches and credentials. Pushes to `main` deploy through the connected GitHub repository. Installation scripts never provision resources, run migrations, or deploy automatically.

To deploy your own instance:

1. After approving resource creation yourself, create a Neon project in your preferred region. Use a separate Neon branch for development and preview; do not point previews at production.
2. Add the runtime variables above to a Vercel Next.js project. Use Node.js 24, `npm ci`, and `npm run build`. Keep production and preview credentials separate. `DATABASE_URL_UNPOOLED` is needed in your migration environment, not by the deployed application.
3. Review and apply `npm run db:migrate` against the intended branch **before** deploying application code that depends on the schema. Migrations deliberately do not run during application startup or the Vercel build.
4. Deploy after your approval. Set the production canonical URL and ensure both cron routes have a 300-second function budget with Fluid compute. Verify that the selected Vercel plan supports this duration. Place the application near the database.
5. Generate the first briefing locally against the production configuration, or invoke the protected production cron endpoint from a trusted environment. Check the homepage, archive, source links, RSS, and Vercel logs.

`vercel.json` schedules generation at **06:00 UTC** and an idempotent recovery attempt at **08:00 UTC**. In Stockholm this is 07:00/09:00 in winter and 08:00/10:00 in summer. Edition dates use UTC. Vercel Hobby jobs may run within their scheduled hour rather than at the exact minute. Cron only runs for production deployments.

Both schedules fit Hobby's daily frequency limit. Cron has no separate charge; executions count toward normal function usage. The current Hobby allowance is 100 cron jobs per project, each running at most once per day. Check [Vercel's current cron limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing) when choosing a plan.

Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically. Missing, short, or incorrect secrets fail closed. Neither endpoint accepts a caller-selected date. The recovery job returns immediately when the edition is already published. Vercel does not automatically retry failed cron executions; the second schedule and manual command provide recovery.

When manually invoking the route, keep the secret in a trusted environment and send it in the Authorization header, never in a URL. A `200` response means publication, an already-published edition, or a successful collection with `no-new-stories`; `202` means another invocation owns the lease or saved work remains; `503` means processing failed and can be retried safely. A pending response requires a later invocation; the response body alone does not schedule work.

Useful deployment references: [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [function duration](https://vercel.com/docs/functions/configuring-functions/duration), and [Neon with Drizzle](https://neon.com/docs/guides/drizzle).

## Correct today’s edition

For an explicitly authorized editorial correction, collect a bounded source snapshot into a local JSON file with the shape returned by `collectArticles()`. The command reads publication history and applies the same relevance, novelty, freshness, and diversity rules as the scheduled pipeline:

```sh
npm run briefing:revise -- /absolute/path/collector-snapshot.json
# Review the printed replacement first, then explicitly apply it:
npm run briefing:revise -- /absolute/path/collector-snapshot.json --apply --backup=/absolute/path/unique-backup.json --expected-published-at=REVIEWED_TIMESTAMP
```

The default is read-only. Copy `reviewedPublishedAt` from that output into `--expected-published-at`. Applying requires a fresh snapshot, that reviewed timestamp, and a new local backup path. Only today’s UTC edition may be corrected; a changed publication timestamp cancels a stale review. Story replacement and republication commit in one transaction, with rollback on any error. Historical editions and the GitHub snapshot remain intact. This maintenance capability has no HTTP endpoint and is never invoked by cron.

## Verification

Vitest tests deterministic normalization, RSS/Atom and official-page parsing, relevance rules, themes, publisher diversity, bounded concurrency, popular and active repository selection, evidence checks, cron authorization, RSS escaping, partial failures, idempotency, and deadline recovery. A development-only PGlite PostgreSQL engine applies the checked-in migrations and exercises the real store queries: lease exclusion, expiry takeover, stale-worker fencing, transaction rollback, foreign keys, and unique dates. Tests require no external credentials or running database. A test explicitly forbids network calls while exercising the local editor.

The GitHub Actions workflow runs formatting, type checks, lint, tests, and the production build. Browser QA covers desktop and mobile navigation, search, next/previous browsing, source dialogs, and archive behavior. Live publication needs your database configuration; collection, curation, themes, and the dated preview can be exercised independently without one.

ESLint 9 and TypeScript 6 are intentionally used because the current Next.js ESLint plugin dependencies do not yet support ESLint 10 / TypeScript 7 together. Runtime libraries use the current stable versions resolved in `package-lock.json`.

## Project map

```text
src/app/                App Router pages, metadata, RSS, API and cron routes
src/components/         Publication UI and shadcn-style Radix primitives
src/lib/sources/        Fixed-endpoint collectors and deterministic normalization
src/lib/editorial/      Pure curation, selection, excerpts, novelty and shared candidate preparation
src/lib/pipeline/       Bounded orchestration, immutable progress transitions and checkpoint contract
src/lib/db/             Drizzle schema, pool, read models, leases and atomic publication
drizzle/                Versioned migrations and Drizzle snapshots
src/lib/schemas.ts     Server-only runtime schemas for domain and persistence boundaries
src/lib/presentation.ts Client-safe reading and search contracts
src/lib/types.ts       Inferred model types shared by server and UI
scripts/                Manual generation, migrations, source diagnostics
tests/                  Business logic and PostgreSQL contract tests
```

## Server and browser boundaries

Collection, curation, excerpt extraction, generation, GitHub access, and PostgreSQL operations are marked with Next.js `server-only`. Importing these modules from a Client Component fails the build. No model provider is connected.

Server Components call `editions.ts` directly. Reading pages serialize a `BriefingView` containing the stories, repository cards, source notes, edition date, and display flags. Generation reports, counters, and checkpoints stay on the server. The browser manages navigation, dialogs, filters, sharing, and the existing same-origin search request. `presentation.ts` is the small client-safe validation contract; domain schemas remain server-only.

The npm maintenance commands set Node's `react-server` condition explicitly so the same protected modules can run in trusted local CLI processes. For a direct invocation, use `node --conditions=react-server --import tsx scripts/<command>.ts`. This condition is not a substitute for credentials or cron authorization. Vitest substitutes only the marker in its Node test environment; a dependency-graph test checks every Client Component, and the production build uses Next.js's real boundary enforcement.

Business outcomes remain in saved editions and cron responses.
