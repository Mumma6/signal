# Process events

`src/lib/observability.ts` provides a small, vendor-independent `observe` boundary. The default sink writes structured JSON to server logs. It records execution status separately from business outcomes. A collector returning zero stories is a successful execution with a zero outcome, not a thrown failure.

The future Flowmark SDK integration belongs to the project owner. There is no Flowmark package, endpoint, credential, or guessed SDK API in this application.

| Process                     | Business outcomes                                             |
| --------------------------- | ------------------------------------------------------------- |
| `source.collection`         | Source identity, accepted articles, rejected/filtered entries |
| `article.processing`        | Collected articles, exact duplicates                          |
| `article.novelty`           | Previously published exclusions and fresh candidates          |
| `briefing.release`          | Failed lease cleanup, separate from the processing failure    |
| `article.relevance`         | Evaluated articles, relevance/duplicate rejections            |
| `article.extraction`        | Validated source excerpts created                             |
| `article.themes`            | Recurring themes backed by independent publisher groups       |
| `github.discovery`          | Search topic, candidate count, incomplete-result flag         |
| `briefing.publication`      | Published editions, published articles, partial publication   |
| `github.release_collection` | Repository identity and metadata availability                 |

Every event includes `execution` (`success` or `failure`) and `durationMs`. Edition-level persisted outcomes additionally record collected, duplicate, invalid/filtered, evaluated, selected, rejected, summarized, unavailable-source, repository, release-failure, and summary-failure counts. Summary failures count unsuccessful attempts, so retries may increase the counter. The final `summaries` count reflects published stories; `selected` reflects the original editorial selection.

An SDK adapter should sit at this boundary, use documented public APIs only, and fail independently of the application. Keep network calls bounded and isolate asynchronous delivery failures inside the adapter. Do not put observability credentials or raw source bodies in event payloads. Application work and database transactions must never depend on the observability service being available. The legacy `summaries` and `summaryFailures` outcome keys now count source excerpts and extraction failures, preserving existing consumers without implying model inference.

The runner attributes shared candidate preparation time to `article.processing`. `article.novelty` and `article.themes` retain their outcome events without repeating preparation. GitHub release events include `releaseUnavailable` separately from `releaseAvailable`, so a successful repository snapshot can still report unavailable release metadata.
