#!/bin/sh
# Entry point of the single-container backend (see Dockerfile).
# Secrets to set on the host: POSTGRES_HOST, POSTGRES_APP_PASSWORD,
# POSTGRES_MIGRATOR_PASSWORD, GROQ_API_KEY.
# Variable to set: FRONTEND_ORIGINS, e.g. ["https://rehabmind.vercel.app"].
set -eu

token() { python -c "import secrets; print(secrets.token_urlsafe(32))"; }

# Redis listens on 127.0.0.1 only and holds nothing that must survive a restart (sessions,
# rate limits, the job queue), so its password is made fresh on every boot. The same goes
# for the audio key: recordings wait on local disk for seconds and die with the container.
export APP_ENV=production
export POSTGRES_PORT="${POSTGRES_PORT:-5432}" POSTGRES_SSL=true
export REDIS_URL=redis://127.0.0.1:6379/0 REDIS_PASSWORD="$(token)"
export AUDIO_STORE=file AUDIO_FILE_DIR=/home/app/audio
export AUDIO_ENCRYPTION_KEY="$(python -c 'import base64, secrets; print(base64.b64encode(secrets.token_bytes(32)).decode())')"
# Required by the settings model; unused with the file audio store.
export S3_ACCESS_KEY=unused S3_SECRET_KEY="$(token)"
export AI_PROVIDER="${AI_PROVIDER:-groq}" SPEECH_PROVIDER="${SPEECH_PROVIDER:-groq}"
export AI_FAKE_FAULT_RATE=0

redis-server --bind 127.0.0.1 --requirepass "$REDIS_PASSWORD" \
  --dir /home/app/redis --save "" --appendonly no &

alembic upgrade head
python -m app.scripts.sync_stimuli

# Speech worker: restart it if it ever exits, without taking the API down.
(while true; do python -m app.workers.main || true; sleep 5; done) &

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-10000}" --no-server-header \
  --proxy-headers --forwarded-allow-ips '*'
