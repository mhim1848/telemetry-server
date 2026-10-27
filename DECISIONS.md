# Architecture Decisions

Short, dated notes on _why_ things are the way they are — the tradeoffs behind the
productization of this telemetry collector. Newest first.

## Day 4 — CI, test depth, docs

**Test depth across the risk surface.** Added coverage for `/api/stats` shape, malformed
payload → 400, the API-key middleware (401/ok, unit-tested with a mocked config — no env
mutation, no DB), WebSocket broadcast (a real `ws` client receives `NEW_TELEMETRY` on
ingest, with the HTTP server actually listening), and transaction rollback (service unit
test with a mocked pool asserting `ROLLBACK` + client release, no COMMIT). Integration
tests stay on a real Postgres and are hermetic (own session, cascade cleanup).

**Separate build tsconfig.** `tsconfig.json` includes `src` (so ESLint's type-aware
project service and ts-jest see the tests); `tsconfig.build.json` extends it and excludes
`src/test`, and `npm run build` uses it — so tests are type-checked but never emitted into
`dist`/the Docker image.

**CI hardened + per-repo.** The server workflow now runs lint + build + migrations (instead
of piping the deleted `schema.sql`) + tests against a Postgres service container, on
`actions/*@v4`, and also triggers on `feature/**`. Each repo carries its own workflow
(frontend: lint/test/build; telemetry-pi: ruff/mypy/pytest) since they're independent repos.

**Docs.** Added a hub README with a Mermaid architecture diagram and API table, plus a short
AI-assisted-development note. A gitignored `INTERVIEW_NOTES.md` holds personal prep.

## Day 2 — Data layer, observability, resilience, Docker

**Migrations via node-pg-migrate.** Schema changes are now ordered, versioned, and
applied exactly once (tracked in `pgmigrations`), replacing the ad-hoc
`CREATE TABLE IF NOT EXISTS` in `schema.sql` (now deleted). The runner (`src/db/migrate.ts`)
reuses the same validated `config` as the app, so both always target the same DB. Chose
node-pg-migrate over Flyway because it's a Node-native npm package — no JVM toolchain in
the app image.

_On the init migration's idempotency:_ a true greenfield first migration would be plain
(`CREATE TABLE foo`, assuming an empty DB and failing loudly otherwise). Ours is the
exception — written idempotently (`CREATE TABLE IF NOT EXISTS`) solely to **adopt** a DB
already provisioned out-of-band (your dev DB from the old `schema.sql`) without erroring.
We could instead have made the baseline **destructive** (`DROP TABLE IF EXISTS … ; CREATE
TABLE …`) to force a clean, known schema, but chose not to because it would wipe the
existing data — the idempotent approach adopts the current tables and keeps their rows.
Every migration after the baseline is plain and non-idempotent on purpose: the framework
already guarantees once-only, in-order execution (via `pgmigrations`), and plain
statements **fail loudly** on unexpected state instead of silently no-op'ing and masking
drift.

**Structured logging with pino + pino-http.** JSON in production, pretty in dev, silent
in test. `pino-http` logs every request with an auto-generated request id. Replaces
scattered `console.*` (config bootstrap still uses `console` — it runs before the logger).
The level is chosen from a per-environment lookup map (`LEVEL_BY_ENV`) and overridable at
runtime via `LOG_LEVEL`, so verbosity can be raised without a code change.

**Liveness vs. readiness.** `/health` reports the process is up; `/ready` runs `SELECT 1`
and returns `503` (not `500`) when the DB is unreachable, so orchestrators distinguish
"not ready yet" from "crashed".

**Graceful shutdown + process guards.** On SIGTERM/SIGINT: terminate WS clients (their
long-lived upgrades would otherwise hold the HTTP server open), close the server, drain
the pool — with a 10s force-exit fallback. `unhandledRejection`/`uncaughtException` are
logged (the latter exits), so failures are visible instead of silent.

**WebSocket heartbeat + origin check.** Ping/pong every 30s terminates dead sockets
(e.g. a slept laptop) so broadcasts don't pile up. The handshake rejects disallowed
origins using the same `CORS_ORIGIN` allow-list as HTTP.

**Ingest auth on write routes only.** `X-API-Key` (constant-time compared) is required on
POST telemetry/sessions and PATCH session; reads and the dashboard WS stay open so the
frontend needs no secret. No-op when no key is configured (dev); production config
guarantees a key is set.

**Session lifecycle endpoints.** Added `GET /api/sessions`, `GET /api/sessions/:id`, and
`PATCH /api/sessions/:id` (status), rounding the resource out from create-only so a client
can list runs and close one (RUNNING → COMPLETED). `PATCH` has a concrete consumer coming
(the Day 3 Pi client marks a run COMPLETED/FAILED on exit). The two `GET`s are currently
**unconsumed** — added for REST completeness and as the backing for a potential future
session-picker/history UI (see the optional post-Day-4 step in the plan). Kept rather than
trimmed by choice.

**Dockerized (server + Postgres).** Multi-stage `Dockerfile` (build → slim non-root
runtime) runs migrations then starts the server. `docker-compose.yml` brings up Postgres +
server with healthchecks; compose runs in `NODE_ENV=production` with a concrete CORS
origin and API key so the production config guard is exercised. Frontend joins compose on
Day 3.

**tsconfig → nodenext + isolatedModules.** Needed so TypeScript resolves packages that
expose types through an `exports` map (node-pg-migrate); `isolatedModules` keeps every
file independently transpilable (and quiets ts-jest).

## Day 1 — Server foundation

**Layered structure over one `app.ts`.** Split the monolith into `config` → `db` →
`schemas` → `services` → `routes` → `middleware` → `ws`, composed by a thin `app.ts`.
Routes handle HTTP, services own SQL/transactions, schemas own validation. This makes
each piece unit-testable and keeps the WebSocket concern out of the data layer (the
route broadcasts the value the service returns).

**zod for runtime validation (v4).** Untrusted request bodies are parsed against a
schema at the edge. One schema gives both the runtime check _and_ the static type via
`z.infer`, so there is a single source of truth and no hand-maintained interface that
can drift. Numeric bounds mirror the DB column capacities, so bad data is rejected as a
`400` instead of surfacing later as a Postgres overflow. (Previously `req.body` was
dereferenced blind and malformed input was masked as a misleading `500`.)

**Central config with fail-fast validation.** All env access goes through `config.ts`,
which validates/coerces with zod and `process.exit(1)`s on invalid config. Production
also refuses to boot with `CORS_ORIGIN=*` or a missing `INGEST_API_KEY`.

**Non-secret defaults vs. required secrets.** Non-secret fallbacks (host, port, db name,
user) live in a named `DEFAULTS` block for readability; **secrets have no default** —
`PGPASSWORD` is required, so a misconfigured deploy fails loudly instead of silently
connecting as `postgres/postgres`. Local values live in a gitignored `.env`; the
committed `.env.example` holds non-matching placeholders only.

**Hermetic integration tests.** Tests create their own session via `POST /api/sessions`
in `beforeAll` and cascade-delete it in `afterAll`, removing the previous dependency on a
magic pre-seeded `session_id = 1`. This also exercises the sessions endpoint end-to-end.

**Central Express error middleware + 404 handler.** `ZodError → 400` with field detail;
everything else → `500` with a generic message (internals logged, not leaked). Relies on
Express 5 forwarding rejected promises from async handlers, so routes stay try/catch-free.

**`cors` package instead of hand-rolled headers.** Handles preflight (`OPTIONS`) correctly
and is driven by `CORS_ORIGIN` (allow-list or reflect-all in dev).

**`COUNT(*) FILTER (WHERE …)` for stats.** Replaced `COUNT(CASE WHEN … END)` with the
SQL-standard aggregate `FILTER` clause — same result, clearer intent.

**New `POST /api/sessions`.** Ingestion needs a valid `session_id` FK but nothing could
create a session; this closes that gap.

**Tooling: ESLint (type-aware) + Prettier, `tsx` for dev.** Type-aware linting catches
unsafe `any` and floating promises. Project-scoped `.npmrc` pins the public npm registry
(the global config pointed at a private CodeArtifact registry).
