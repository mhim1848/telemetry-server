# Architecture Decisions

Short, dated notes on *why* things are the way they are — the tradeoffs behind the
productization of this telemetry collector. Newest first.

## Day 1 — Server foundation

**Layered structure over one `app.ts`.** Split the monolith into `config` → `db` →
`schemas` → `services` → `routes` → `middleware` → `ws`, composed by a thin `app.ts`.
Routes handle HTTP, services own SQL/transactions, schemas own validation. This makes
each piece unit-testable and keeps the WebSocket concern out of the data layer (the
route broadcasts the value the service returns).

**zod for runtime validation (v4).** Untrusted request bodies are parsed against a
schema at the edge. One schema gives both the runtime check *and* the static type via
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
