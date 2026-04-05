# Atoll OS

[![Live site badge](https://img.shields.io/badge/site-live-22A4B4?style=for-the-badge)](https://zivhm.github.io/Atoll-OS/)
[![Deploy landing to GitHub Pages](https://github.com/zivhm/Atoll-OS/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/zivhm/Atoll-OS/actions/workflows/deploy-pages.yml)
[![License badge](https://img.shields.io/github/license/zivhm/Atoll-OS?style=flat-square)](LICENSE)
![Self-hosted control plane badge](https://img.shields.io/badge/self--hosted-control%20plane-1C1F2A?style=flat-square)
![Docker runtime badge](https://img.shields.io/badge/runtime-Docker-2496ED?style=flat-square)
![React and Vite badge](https://img.shields.io/badge/web-React%20%2B%20Vite-61DAFB?style=flat-square)
![Fastify and TypeScript badge](https://img.shields.io/badge/api-Fastify%20%2B%20TypeScript-000000?style=flat-square)

**Meet your next favorite employee.**

Atoll removes the busywork of creating and managing helpers, so you can focus on your work.

[Landing page](https://zivhm.github.io/Atoll-OS/) · [Quick start](#quick-start) · [Docker Compose](#docker-compose) · [Core concepts](#core-concepts) · [Configuration](#configuration)

| Atoll control plane |
| :---: |
| ![Atoll control plane](web/public/images/landing.png) |

## App Preview

Replace these placeholders with product screenshots when you are ready. A simple pattern is to drop images into `docs/images/` and update the paths below.

| Helper setup | Runtime operations |
| :---: | :---: |
| `Placeholder: helper creation flow screenshot` | `Placeholder: runtime health, logs, and repair view screenshot` |

| Identity catalog | Channel configuration |
| :---: | :---: |
| `Placeholder: identities screen screenshot` | `Placeholder: Telegram / Discord configuration screenshot` |

## Why Atoll

Most agent projects focus on the helper itself. Atoll focuses on the operating layer around it.

- Create helpers with reusable identities, role definitions, and skill/tool context.
- Provision Docker-backed runtimes without hand-wiring every instance.
- Place helpers in shared or dedicated workspaces.
- Configure channels such as Telegram and Discord from the same UI.
- Operate helpers from the browser with chat, logs, health checks, repair, reconcile, and event history.
- Keep local state simple while protecting sensitive runtime credentials behind an app-level secrets key.

## At A Glance

### What you can do

- `Quick helper setup`: spin up a helper, assign a workspace, and provision a runtime in minutes.
- `Identity catalog`: manage reusable business identities and helper presets from the UI.
- `Runtime operations`: inspect health, logs, events, repair actions, and reconcile flows.
- `Channel wiring`: expose helper settings for Telegram and Discord without spreading config across tools.
- `Single-host friendly`: run locally during development or in Docker Compose for a small self-hosted deployment.

### What Atoll is optimized for today

- Local and single-host operation.
- Docker-managed helper runtimes.
- OpenClaw-backed execution today, with a long-term direction toward harness-agnostic runtime support.

## Quick Start

### Prerequisites

- Node.js `20+`
- `npm`
- Docker Desktop or another reachable Docker engine

On Windows, `npm run dev` attempts to start Docker Desktop automatically if Docker is not reachable. The UI can still boot without Docker, but provisioning and runtime lifecycle actions will not work until Docker is available.

### Local development

1. Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

```bash
cp .env.example .env
```

1. Edit `.env` and set at least:

- `ATOLL_SECRETS_KEY`: required, long random string used to protect stored secrets.
- `ATOLL_LLM_PROVIDER_API_KEY`: optional default provider key for new helpers.

1. Install dependencies:

```powershell
npm install
```

```bash
npm install
```

1. Start the API and app together:

```powershell
npm run dev
```

```bash
npm run dev
```

1. Open:

- App UI: [http://127.0.0.1:8080](http://127.0.0.1:8080)
- API: [http://127.0.0.1:8450](http://127.0.0.1:8450)

`npm run dev` pins the API to `PORT` or `8450` by default and configures Vite to proxy `/api` requests to that origin.

## Docker Compose

For a containerized single-host deployment:

1. Create `.env` from the example:

```powershell
Copy-Item .env.example .env
```

```bash
cp .env.example .env
```

1. Set `ATOLL_SECRETS_KEY` in `.env`.

1. Build and start:

```powershell
docker compose up --build
```

```bash
docker compose up --build
```

1. Open [http://127.0.0.1:8450](http://127.0.0.1:8450)

In Docker mode, the built frontend is served by the API container on the same port. Compose stores runtime data in the `atoll_data` volume and mounts the Docker socket so Atoll can manage helper runtimes.

## Core Concepts

### Workspaces

Atoll uses tenants as workspaces.

- `default`: an individual helper workspace for quick setup.
- `dedicated`: a shared workspace with reusable network and storage context.

### Helpers

A helper is the user-facing agent record: name, avatar, role title, preset, skills, and channel settings.

### Runtimes

A runtime is the managed execution environment attached to a helper.

Atoll provisions the current helper runtime through Docker, tracks its status, and exposes lifecycle actions through the API and UI.

### Identities

Reusable identity presets live under [`src/business-identities`](src/business-identities) and are editable in the `/identities` screen. These presets seed helper identity, soul, and tools documents.

## Architecture

Atoll is structured as a small control plane:

- `API layer`: Fastify routes for auth, settings, tenants, helpers, runtime operations, and event history.
- `Web UI`: React + Vite app for setup, operations, channel config, and identity management.
- `Runtime host`: Docker-backed runtime provisioning and lifecycle control.
- `Persistence`: local JSON state plus encrypted secrets.

## Stack

- API: Fastify + TypeScript
- Web: React 18, Vite, Tailwind, Radix UI, React Query
- Runtime host: Docker
- Persistence: local JSON state file plus encrypted secrets

## Configuration

Most day-to-day configuration comes from the repo-root `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ATOLL_SECRETS_KEY` | Yes | Encryption key for stored secrets and sensitive runtime configuration |
| `ATOLL_LLM_PROVIDER_API_KEY` | No | Default provider API key used when a helper does not have its own |
| `PORT` | No | API port, defaults to `8450` in local and container examples |
| `HOST` | No | API bind host |
| `RUNTIME_PROVIDER` | No | Default LLM provider for newly provisioned helpers |
| `RUNTIME_MODEL` | No | Default LLM model for newly provisioned helpers |
| `RUNTIME_HTTP_TIMEOUT_MS` | No | Runtime HTTP request timeout in milliseconds, default `3600000` |
| `RUNTIME_OPENCLAW_IMAGE` | No | OpenClaw runtime image override |
| `RUNTIME_STARTUP_VALIDATION` | No | Runtime prerequisite validation mode: `strict`, `warn`, or `off` |
| `RUNTIME_ALLOW_PUBLIC_BIND` | No | Whether helper gateways bind to host loopback by default |
| `RUNTIME_REQUIRE_PAIRING` | No | Whether pairing is required for runtimes that support it |
| `ATOLL_CORS_ALLOWED_ORIGINS` | No | Needed only when the web app is served from a different origin than the API |

The Settings screen writes managed runtime defaults back into the repo-root `.env`. Those changes require an API restart to fully apply.

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

- Helper setup and workspace creation
- Runtime provisioning and lifecycle control
- Runtime chat and diagnostics
- Channel configuration
- Identity catalog management

## Project Structure

```text
src/                      Fastify API, runtime orchestration, storage, identity presets
src/http/routes/          API route modules
src/business-identities/  Reusable helper identity presets
web/                      React/Vite control-plane frontend
landing/                  GitHub Pages landing site
scripts/                  Development helpers
tests/                    API/runtime-focused tests
Dockerfile                Production image build
docker-compose.yml        Single-host deployment
atoll-state.json          Local persisted state file
```

## Runtime Notes

- Current supported runtime: OpenClaw
- Intended direction: harness-agnostic runtime support over time
- Default runtime type: `openclaw`
- Default hosted provider: `openrouter`
- Default hosted model: `anthropic/claude-sonnet-4.6`
- Frontend production assets are served from `web/dist` when present

If the frontend build is missing in production mode, non-API browser requests return `503` with a message telling you to run `npm run build` or use `npm run dev`.

## Landing Page

The public GitHub Pages site is the marketing surface for the project:

- Site: [https://zivhm.github.io/Atoll-OS/](https://zivhm.github.io/Atoll-OS/)
- Source: [`landing/`](landing/)

The self-hosted control-plane app itself lives in [`web/`](web/) and is what you run locally or in Docker Compose.

## License

See [`LICENSE`](LICENSE).
