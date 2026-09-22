# HR Management & Business Operations Platform

Multi-tenant HR / business-operations SaaS. Rails 8.1 API backend, Next.js frontend,
PostgreSQL, Redis, Sidekiq, S3-compatible object storage.

This repository currently implements the **foundation**: multi-tenancy, authentication,
RBAC, audit logging, and a thin frontend slice proving the whole stack end-to-end. Full
module build-out (Zoho Mail, HR, Accounts) is sequenced in phases — see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for what's built vs. what's next.

## Stack

| Layer | Choice |
|---|---|
| Backend | Ruby 4.0 / Rails 8.1 (API-only) |
| Frontend | Next.js (App Router) / React / TypeScript |
| Database | PostgreSQL 18 |
| Cache / queue backend | Redis 7 |
| Background jobs | Sidekiq (+ sidekiq-cron), via ActiveJob |
| Object storage | S3-compatible (MinIO locally; S3 or R2 in staging/prod) |
| UI | Tailwind v4, shadcn/ui, Lucide icons |
| Data/forms | TanStack Query, TanStack Table, React Hook Form, Zod |
| Auth | Cookie-based sessions (not JWT/localStorage) — see `docs/ARCHITECTURE.md` |

## Repository layout

```
backend/          Rails API app
frontend/          Next.js app
infrastructure/    Deployment/reverse-proxy config, future IaC
docs/              Architecture, ERD, API conventions, design system
docker-compose.yml
.env.example
```

## Prerequisites

- Ruby 4.0.x (via rbenv/asdf — see `backend/.ruby-version`)
- Node 24.20.x LTS (via nvm — see `.nvmrc`; run `nvm use` in the repo root)
- Docker + Docker Compose
- PostgreSQL and Redis are **not** required natively — they run in Docker (see below)

## Quick start

```bash
cp .env.example .env   # fill in real values only where you need to (dev defaults work as-is)

# Infra: Postgres, Redis, MinIO
docker compose up -d postgres redis minio minio-init

# Backend
cd backend
bundle install
bin/rails db:create db:migrate db:seed
bin/rails s -p 4000

# Frontend (separate terminal)
cd frontend
nvm use
npm install
npm run dev
```

Frontend: http://localhost:3000 · Backend: http://localhost:4000 ·
MinIO console: http://localhost:9001 · Sidekiq dashboard: http://localhost:4000/sidekiq
(Admin-only)

Run the full containerized stack instead (closer to production, no hot reload):

```bash
docker compose up --build
```

## Tests

```bash
# Backend
cd backend
bundle exec rspec
bundle exec rubocop
bundle exec brakeman -q

# Frontend
cd frontend
npm run lint
npx tsc --noEmit
npx vitest run
npx playwright test
```

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, auth/tenancy/CSRF
  model, what's built vs. sequenced next
- [`docs/ERD.md`](docs/ERD.md) — database schema
- [`docs/API_CONVENTIONS.md`](docs/API_CONVENTIONS.md) — REST conventions, envelope
  format, permission catalog
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — color tokens, typography,
  component conventions
- Live OpenAPI docs (once the backend is running): `http://localhost:4000/api-docs`

## Environment variables

See [`.env.example`](.env.example) for the full list with explanations. Never commit a
real `.env`.
