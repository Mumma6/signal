# Working on Signal

- Next.js App Router, TypeScript, Tailwind, local shadcn-style Radix primitives, Drizzle, and PostgreSQL. Keep this a single application; no accounts, queues, Redis, or separate backend.
- Read `README.md` and `docs/architecture.md` before changing the pipeline. Run `npm run check`, `npm run format:check`, and `npm run build` for relevant changes.
- Mark backend runtime modules with `server-only`; Client Components must import only presentation utilities, client-safe contracts, or erased types. CLI npm commands set the `react-server` condition; keep it when adding maintenance commands.
- Send `BriefingView` to the reader, not persistence records, source collection reports, or generation state. Server Components should call services directly; retain thin handlers only for external entry points.
- Ownership: pure rules in `src/lib/editorial`, orchestration and immutable checkpoint transitions in `src/lib/pipeline`, transport/parsing in `src/lib/sources`, and all Drizzle operations in `src/lib/db`. `pipeline/index.ts` composes actual dependencies; `editions.ts` owns React caching and preview policy.
- Keep `editorial` independent of HTTP, PostgreSQL, React, environment reads, and workflow code. Share candidate preparation across cron, previews, and corrections. Prefer readonly inputs and explicit clocks; local maps/loops are fine when they simplify an algorithm.
- Server domain schemas belong in `src/lib/schemas.ts`; client-safe reading/search contracts belong in `presentation.ts`. Infer shared types in `types.ts`. Validate external JSON and database checkpoints instead of casting. Preserve the deployed JSON shape and optional legacy checkpoint fields.
- Publication and corrections share `db/publication.ts` inside their caller's transaction. Keep driver assertions confined to the PGlite test harness. Preserve original errors when cleanup fails; never log raw provider payloads or credentials.
- Preserve original URLs, source attribution, exact evidence, and the distinction between source facts and editorial inference. Never substitute fabricated news or metrics for unavailable data.
- No AI providers or model keys. The owner explicitly wants provider-free curation: local rules, source excerpts, text similarity, and recurring-phrase themes. Do not add inference calls without explicit authorization.
- Keep date uniqueness, lease fencing, checkpoints, and transactional publication intact. Every retry must be safe. A failing source must not take down unrelated collection work.
- Schema changes require reviewed Drizzle migrations and tests. Never run production `push`, apply migrations, create cloud resources, or deploy without explicit authorization.
- Preserve the calm editorial design, keyboard access, responsive layouts, and reduced-motion behavior. Prefer source-grounded usefulness over dashboard decoration.
- Never commit credentials. Preview mode is explicitly labeled; configured production databases must never silently fall back to sample data.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
