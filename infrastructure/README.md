# Infrastructure

Deployment-related configuration that doesn't belong inside either app: reverse-proxy
config, environment-specific overrides, and future infrastructure-as-code.

Currently minimal by design — local/dev infra is fully described by the root
`docker-compose.yml`, and `backend/Dockerfile` / `frontend/Dockerfile` are colocated
with their apps rather than duplicated here. This directory is where staging/production
deployment config (reverse proxy, TLS termination, IaC for whichever provider gets
picked — see `docs/ARCHITECTURE.md` on staying provider-agnostic) lands once that
decision is made. Nothing here yet because that decision hasn't been made yet — this
isn't an oversight.
