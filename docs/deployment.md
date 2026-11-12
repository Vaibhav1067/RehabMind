# Deployment (self-hosted, $0)

RehabMind runs as a single Docker Compose stack. No paid services, no API keys: speech
recognition and the AI provider run locally. Academic prototype — not certified for
clinical use.

```bash
python scripts/generate_prod_env.py                      # once; writes .env.production
docker compose --env-file .env.production -f compose.prod.yaml up -d --build
# create accounts (password prompted; never passed as an argument)
docker compose --env-file .env.production -f compose.prod.yaml exec api \
  python -m app.scripts.create_user --email dr@example.org --name "Dr. A" --role clinician
docker compose --env-file .env.production -f compose.prod.yaml exec api \
  python -m app.scripts.create_user --email pat@example.org --name "Sam" --role patient \
  --assign-to dr@example.org
```

Open `https://localhost` (Caddy's local CA: accept the certificate warning, or trust the CA).
After the first admin exists, further accounts can be added in the app (**Accounts → Add a
user**). The system generates a 16-character first password, shows it to the admin once and
stores only its Argon2id hash.
The clinician sets practice limits in the UI before the patient can practise.

## Public server (real AI, public certificate)

On a Linux host with Docker, ports 80 and 443 open, and a hostname pointing at it
(`<ip-with-dashes>.sslip.io` works without buying a domain):

```bash
python3 scripts/generate_prod_env.py --site-address 203-0-113-7.sslip.io --ai ollama
docker compose --env-file .env.production -f compose.prod.yaml up -d --build
```

A non-localhost address sets `TLS_ISSUER=acme` (Caddy obtains a public certificate).
`--ai ollama` enables the `ai` profile: an `ollama` service inside the stack, plus a one-shot
download of `qwen2.5:3b` (~2 GB). Allow 8 GB RAM or more with the model loaded.

## Free hosted demo (no server, no card)

For a public demo without a server: the frontend on Vercel, the backend on Render's free
instance (512 MB), Postgres on Neon. The language model and speech recognition do not fit
in 512 MB, so this variant uses Groq's hosted API for both: **recordings and prompts leave
the server**, unlike the self-hosted stack. Demo data only.

1. Neon: create a project, then `cd backend && uv run python -m app.scripts.setup_external_db`
   (creates the roles and database, writes the three `POSTGRES_*` values to `.env.space`).
2. Render: new web service from this repository using `render.yaml` (Docker,
   `deploy/render/Dockerfile`, free plan). Set `POSTGRES_HOST`, `POSTGRES_MIGRATOR_PASSWORD`,
   `POSTGRES_APP_PASSWORD`, `GROQ_API_KEY` and `FRONTEND_ORIGINS` (a JSON list holding the
   Vercel address). The container runs the API, the worker and Redis; migrations run on boot.
3. Vercel: project with root directory `frontend` and `BACKEND_URL` set to the Render address.

Limits: the backend sleeps after 15 idle minutes and takes about a minute to wake; sessions
and queued audio do not survive a restart; no shell, so create the first accounts by running
`app.scripts.create_user` from a machine that can reach the database.

## Topology

```
browser ──HTTPS──▶ caddy (only published ports: 80→443, 443)
                     └─▶ web (Next.js standalone, :3000)
                           └─▶ api (FastAPI, :8000)  ─▶ postgres, redis, minio
                         worker (ARQ + faster-whisper) ─▶ postgres, redis, minio
one-shot: migrate (Alembic as schema owner + picture library sync)
          storage-init (bucket, lifecycle, least-privilege app user; only holder of root keys)
```

| Concern | How |
|---|---|
| TLS | Caddy; `tls internal` for localhost. For a real domain set `SITE_ADDRESS` and remove `tls internal` (automatic certificate). HSTS set. |
| Secrets | `.env.production` (git-ignored, generated). Each service receives only the variables it needs; settings refuse placeholder or short secrets in production. |
| Least privilege | DB runtime role DML-only; storage app user limited to `ephemeral-audio/audio/*`; containers run as non-root (uid 10001 / node `app`). |
| Exposure | API, DB, Redis, MinIO publish no ports; only Caddy does. API docs disabled in production. |
| Dev data | `seed_dev` refuses outside `APP_ENV=development`. |
| First start | The worker downloads Whisper `small.en` (~480 MB) once into the `whisper-models` volume. |
| Backups | `postgres-data` volume holds all records; MinIO holds only transient audio (no backup needed). Use `pg_dump` as the `postgres` user for backups. |

Verified locally: HTTPS, CSP/HSTS headers, `__Host-` Secure cookie, clinician → limits →
patient practice, real speech answer transcribed and audio deleted, API not reachable
directly, cross-care-team access denied.

## Not covered (would be needed for real clinical deployment)

Managed key service for `AUDIO_ENCRYPTION_KEY`, encrypted volumes/backups, centralised log
retention, uptime monitoring and alerting, a data-processing agreement and clinical safety
case, penetration testing, and user/account management in the UI (CLI only here).
