# syntax=docker/dockerfile:1

# --- Stage 1: build the React frontend ---
FROM node:22-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build      # -> /fe/dist

# --- Stage 2: Python backend that serves the API + the built frontend ---
FROM python:3.11-slim
WORKDIR /app/backend

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Extra libraries that skill scripts need (skills/requirements.txt). Skills run
# with this same Python, so anything installed here is importable from a script.
COPY skills/requirements.txt /app/skills/requirements.txt
RUN pip install --no-cache-dir -r /app/skills/requirements.txt

COPY backend/ /app/backend/
COPY skills/ /app/skills/
COPY --from=frontend /fe/dist /app/frontend/dist

ENV SKILLS_DIR=/app/skills \
    FRONTEND_DIST=/app/frontend/dist \
    OLLAMA_BASE_URL=http://host.docker.internal:11434/v1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
