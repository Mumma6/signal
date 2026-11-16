# Working on Signal

- Next.js App Router, TypeScript, Tailwind, local shadcn-style Radix primitives, Drizzle, and PostgreSQL. Keep this a single application; no accounts, queues, Redis, or separate backend.
- Read `README.md` and `docs/architecture.md` before changing the pipeline. Run `npm run check`, `npm run format:check`, and `npm run build` for relevant changes.
- Put collectors in `src/lib/sources`, business orchestration in `src/lib/pipeline`, and persistence in the store. Keep pure normalization/selection functions testable.
- Preserve original URLs, source attribution, exact evidence, and the distinction between source facts and editorial inference. Never substitute fabricated news or metrics for unavailable data.
- No AI providers or model keys. The owner explicitly wants provider-free curation: local rules, source excerpts, text similarity, and recurring-phrase themes. Do not add inference calls without explicit authorization.
- Keep date uniqueness, lease fencing, checkpoints, and transactional publication intact. Every retry must be safe. A failing source or telemetry sink must not take down unrelated work.
- Schema changes require reviewed Drizzle migrations and tests. Never run production `push`, apply migrations, create cloud resources, or deploy without explicit authorization.
- No Flowmark SDK integration: the project owner is handling it. Keep the existing process events vendor-independent.
- Preserve the calm editorial design, keyboard access, responsive layouts, and reduced-motion behavior. Prefer source-grounded usefulness over dashboard decoration.
- Never commit credentials. Preview mode is explicitly labeled; configured production databases must never silently fall back to sample data.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
