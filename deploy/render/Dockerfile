# RehabMind backend as ONE small container, for a free 512 MB instance (Render).
# Runs the API, the speech worker and Redis together. Postgres is external (Neon); the
# language model and speech recognition are hosted (Groq), because neither fits in 512 MB.
# Build context: the repository root.
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv

RUN apt-get update \
    && apt-get install -y --no-install-recommends redis-server \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv==0.11.21
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/alembic.ini ./
COPY backend/migrations ./migrations
COPY backend/app ./app
COPY deploy/render/start.sh ./

RUN useradd --system --uid 10001 --create-home app \
    && mkdir -p /home/app/audio /home/app/redis \
    && chown -R app:app /home/app
USER app
ENV PATH=/opt/venv/bin:$PATH

EXPOSE 10000
CMD ["sh", "start.sh"]
