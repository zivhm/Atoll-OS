# Atoll OS

Atoll is a self-hosted control plane for managing AI helpers backed by Docker-managed runtimes. It combines a Fastify API, a React web console, a reusable identity catalog, and runtime orchestration around an OpenClaw-based helper runtime.

The current implementation is optimized for local or single-host operation: create helpers, assign them to a default or dedicated workspace, provision a runtime, configure channels, and operate the helper from the browser UI.

## What It Does

- Creates and manages helpers inside shared or dedicated workspaces.
- Provisions Docker-backed OpenClaw helper runtimes.
- Persists app state locally in `atoll-state.json` or a configured data path.
- Stores sensitive runtime credentials behind an app-level secrets key.
- Supports runtime chat, health checks, logs, repair, reconcile, and event history.
- Exposes channel settings for Telegram, Slack, and Discord.
- Includes an admin-style identity catalog for managing helper presets from the UI.
- Serves the built frontend from the API process in production mode.

## Stack

- API: Fastify + TypeScript
- Web: React 18, Vite, Tailwind, Radix UI, React Query
- Runtime host: Docker / Docker Desktop
- Persistence: local JSON state file plus encrypted secrets

## Core Concepts

### Workspaces

Atoll uses tenants as workspaces.

- `default`: an individual helper workspace for quick setup
- `dedicated`: a shared workspace with reusable network/storage context

### Helpers

A helper is the user-facing agent record: name, avatar, role title, preset, skills, and channel settings.

### Runtimes

A runtime is the managed execution environment attached to a helper. The current public support target is `openclaw`.

Atoll provisions the current helper runtime through Docker, tracks its status, and exposes lifecycle actions through the API and UI. The long-term direction is harness-agnostic support rather than coupling the control plane to a single runtime forever.

### Identities

Reusable identity presets live under [`src/business-identities`](src/business-identities) and are editable in the `/identities` screen. These presets seed helper identity, soul, and tools documents.

## Local Development

### Prerequisites

- Node.js 20+
- npm
- Docker Desktop or a reachable Docker engine

On Windows, `npm run dev` will try to start Docker Desktop automatically if Docker is not reachable. The web UI can still boot without Docker, but runtime provisioning and lifecycle actions will not work until Docker is available.

### Setup

1. Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

2. Edit `.env` and set at least:

- `ATOLL_SECRETS_KEY`: required, long random string used to protect stored secrets
- `ATOLL_LLM_PROVIDER_API_KEY`: optional default provider key for new helpers

3. Install dependencies:

```powershell
npm install
```

4. Start the API and web app together:

```powershell
npm run dev
```

5. Open the app:

- Web UI: [http://127.0.0.1:8080](http://127.0.0.1:8080)
- API: [http://127.0.0.1:8450](http://127.0.0.1:8450)

`npm run dev` pins the API to `PORT` or `8450` by default and configures Vite to proxy `/api` requests to that origin.

## Docker Compose

For a containerized single-host deployment:

1. Create `.env` from the example:

```powershell
Copy-Item .env.example .env
```

2. Set `ATOLL_SECRETS_KEY` in `.env`.

3. Build and start:

```powershell
docker compose up --build
```

4. Open [http://127.0.0.1:8450](http://127.0.0.1:8450)

In Docker mode, the built frontend is served by the API container on the same port. Compose stores runtime data in the `atoll_data` volume and mounts the Docker socket so Atoll can manage helper runtimes.

## Environment

Most day-to-day configuration comes from the repo-root `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ATOLL_SECRETS_KEY` | Yes | Encryption key for stored secrets and sensitive runtime configuration |
| `ATOLL_LLM_PROVIDER_API_KEY` | No | Default provider API key used when a helper does not have its own |
| `PORT` | No | API port, defaults to `8450` in local and container examples |
| `HOST` | No | API bind host |
| `RUNTIME_PROVIDER` | No | Default LLM provider for newly provisioned helpers |
| `RUNTIME_MODEL` | No | Default LLM model for newly provisioned helpers |
| `RUNTIME_OPENCLAW_IMAGE` | No | OpenClaw runtime image override |
| `RUNTIME_STARTUP_VALIDATION` | No | Runtime prerequisite validation mode: `strict`, `warn`, or `off` |
| `RUNTIME_ALLOW_PUBLIC_BIND` | No | Whether helper gateways bind to host loopback by default |
| `RUNTIME_REQUIRE_PAIRING` | No | Whether pairing is required for runtimes that support it |
| `ATOLL_CORS_ALLOWED_ORIGINS` | No | Only needed when the web app is served from a different origin than the API |

The Settings screen writes managed runtime defaults back into the repo-root `.env`. Those changes require an API restart to fully apply.

## Authentication Model

This repo currently runs in local auth mode.

- The API injects a local auth context for each request.
- The default identity comes from `ATOLL_LOCAL_AUTH_SUB` and `ATOLL_LOCAL_AUTH_ORG_ID`.
- Dev-only header overrides are available only when `ATOLL_LOCAL_AUTH_ALLOW_HEADER_OVERRIDES=true`.

There is no external sign-in flow in the current implementation.

## Main Scripts

```powershell
npm run dev
npm run dev:api
npm run dev:web
npm run build
npm run start
npm run typecheck
npm run test
```

Additional useful commands:

- `npm run lint`
- `npm run web:preview`

## Project Structure

```text
src/              Fastify API, runtime orchestration, storage, identity presets
src/http/routes/  API route modules
src/business-identities/
web/              React/Vite frontend
scripts/          Development helpers
tests/            API/runtime-focused tests
Dockerfile        Production image build
docker-compose.yml
atoll-state.json  Local persisted state file
```

## API Surface

The API is intentionally host-oriented and UI-driven. Major route groups include:

- `/api/healthz`
- `/api/auth/me`
- `/api/settings/config`
- `/api/tenants`
- `/api/agents`
- `/api/agent-presets`
- `/api/admin/agent-presets`
- `/api/runtime/catalog`
- `/api/runtime/provision-jobs`
- `/api/runtime/provision-requests`
- `/api/runtime/instances/*`
- `/api/runtime/events`
- `/api/runtime/model-catalog`

The frontend currently uses these APIs for:

- helper setup and workspace creation
- runtime provisioning and lifecycle control
- runtime chat and diagnostics
- channel configuration
- identity catalog management

## Current Runtime Behavior

- Current supported runtime: OpenClaw
- Intended direction: harness-agnostic runtime support over time
- Default runtime type: `openclaw`
- Default hosted provider: `openrouter`
- Default hosted model: `anthropic/claude-sonnet-4.6`
- Frontend production assets are served from `web/dist` when present

If the frontend build is missing in production mode, non-API browser requests return a `503` with a message telling you to run `npm run build` or use `npm run dev`.

## Validation

Before shipping changes, use:

```powershell
npm run typecheck
npm run test
```

For a production artifact check, also run:

```powershell
npm run build
```

## License

See [`LICENSE`](LICENSE).
