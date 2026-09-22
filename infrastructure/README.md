# Infrastructure

Deployment configuration that belongs to neither app.

```
infrastructure/nginx/hrms.conf    reverse proxy (see below)
```

## Topology

```
          :80/:443
   browser ────────► nginx ──┬──► Next.js  127.0.0.1:3000
                             └──► Rails    127.0.0.1:4000
                                  Sidekiq  (no port; Redis-driven)
```

Both apps bind to **loopback only**. Only nginx is exposed — otherwise the
`X-Forwarded-*` headers it sets can be spoofed by anyone who can reach the ports.

## Ports

| Process | Port | Set by |
|---|---|---|
| Rails (Puma) | **4000** | `PORT` — `config/puma.rb` reads `ENV.fetch("PORT", 3000)` |
| Next.js | **3000** | `next start` default, or `PORT` in its own environment |
| Postgres | 5442 | `DATABASE_PORT` |
| Redis | 6390 | `REDIS_URL` |
| MinIO | 9000/9001 | dev only; use real S3/R2 in production |

## nginx

```bash
sudo cp infrastructure/nginx/hrms.conf /etc/nginx/sites-available/hrms
sudo ln -s /etc/nginx/sites-available/hrms /etc/nginx/sites-enabled/hrms
sudo nginx -t && sudo systemctl reload nginx
```

Change `server_name` first, and keep it in step with `FRONTEND_ORIGINS`.

**`/rails/` must reach the backend.** `production.rb` sets
`active_storage.resolve_model_to_route = :rails_storage_proxy`, so every profile
photo, document download and resume preview is served by Rails at
`/rails/active_storage/...`. Route that to the frontend and every image and
download in the product 404s. The supplied config handles it; don't simplify the
location block to just `/api`.

## Required environment

Set these on the server before first boot. The app **refuses to start** without
the first one rather than guessing.

| Variable | Notes |
|---|---|
| `FRONTEND_ORIGINS` | Public origin(s), comma-separated, e.g. `https://hrms.example.com`. Drives CORS, CSRF origin checks and every emailed link. **No default in production** — see `lib/frontend_origins.rb`. |
| `SECRET_KEY_BASE` | `bin/rails secret` |
| `PORT` | `4000` |
| `RAILS_ENV` | `production` |
| `DATABASE_*` / `REDIS_URL` | Real hosts, not localhost, unless colocated |
| `FORCE_SSL` | `false` **until a certificate exists**, then `true`. See below. |
| `SMTP_*`, `MAIL_FROM` | Or no mail is delivered; the app logs a warning at boot |
| `S3_*` | Real S3/R2 bucket and credentials |

`NEXT_PUBLIC_API_URL` should be **empty** in production. nginx puts both apps on
one origin, so the browser calls `/api/v1/...` relatively — which is what
`src/lib/api-client.ts` falls back to, and it avoids CORS entirely. It is inlined
at **build** time, so it must be right when `npm run build` runs, not at boot.

### FORCE_SSL and the chicken-and-egg

`production.rb` defaults `FORCE_SSL` to true, which marks every cookie `Secure`.
Browsers silently discard those over plain HTTP, so **nobody can log in and
nothing appears in the logs**. If you are deploying to a bare IP or before
certbot has run, set `FORCE_SSL=false`, then flip it to `true` the moment TLS is
in front.

## Still missing

Deliberately flagged rather than guessed at — the deployment target hasn't been
chosen (see `docs/ARCHITECTURE.md` on staying provider-agnostic):

- **No `Dockerfile` for either app**, though `frontend/next.config.ts` sets
  `output: "standalone"` and its comment references one.
- **No `docker-compose.yml`** at the repo root, though `README.md` references it.
  The running dev containers come from a compose file outside this checkout.
- **No process supervision.** Rails, Next and Sidekiq each need a systemd unit
  (or equivalent) to start on boot and restart on failure.
