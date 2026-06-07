# Per-runtime notes — Dockerfile, listen port, config keys, health

The pipeline is identical across stacks. Only the Dockerfile, the port, the env-key
names, and the health endpoint differ. Pick your stack below; everything else in the
skill is unchanged. Always bind to `0.0.0.0` (not `localhost`) inside the container,
and read the port from `PORT` where idiomatic.

## Node.js (Express/Nest/Fastify)

```dockerfile
# Dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build            # if TypeScript/bundled; skip for plain JS
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app .
RUN npm ci --omit=dev
EXPOSE 8080
CMD ["node", "dist/main.js"]  # adjust entrypoint
```

- Listen: `app.listen(process.env.PORT || 8080, "0.0.0.0")`.
- Env keys (flat): `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, etc. — render
  these directly into `app.env`.
- Health: add `GET /health` returning 200 `"healthy"`; for readiness, ping the DB
  (`SELECT 1` / Prisma `$queryRaw`) and return 503 if it fails.
- `slim` images have no curl/wget — health-check externally (see SKILL.md).

## Python (FastAPI/Django/Flask)

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["sh","-c","uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]   # FastAPI
# Django: gunicorn app.wsgi --bind 0.0.0.0:8080  (+ run migrations as a release step)
```

- Env keys: `DATABASE_URL`, `SECRET_KEY`, etc. Django: set `ALLOWED_HOSTS` to your
  domain (the host-allowlist gotcha — internal probes need the Host header).
- A worker is often a separate Celery/RQ process: a second compose service running
  `celery -A app worker`.

## Go

```dockerfile
FROM golang:1.23 AS build
WORKDIR /src
COPY go.* ./ && RUN go mod download
COPY . . && RUN CGO_ENABLED=0 go build -o /app/server ./cmd/server
FROM gcr.io/distroless/static
COPY --from=build /app/server /server
EXPOSE 8080
ENTRYPOINT ["/server"]
```

- distroless has no shell/curl — definitely health-check externally.
- Env keys: flat env vars read via `os.Getenv`.

## .NET (this project's stack)

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish YourApi.csproj -c Release -o /app/publish
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet","YourApi.dll"]
```

- Config keys use `__` for nesting: `ConnectionStrings__DefaultConnection`,
  `Jwt__Secret`, `Google__ClientId`, `Cors__AllowedOrigins__0`, `AllowedHosts`.
- The `aspnet` image has no wget/curl, and `AllowedHosts` rejects probes without the
  right Host header — both gotchas covered in SKILL.md.
- A background worker is a separate project/container; if it uses ASP.NET shared
  framework (Hangfire/Serilog.AspNetCore) it needs the `aspnet` base image, not
  `runtime`.

## DB migrations

If the app needs schema migrations, run them as a **release step**, not on every
container start (avoids races between multiple replicas). Options: a one-shot compose
service that runs the migrate command and exits, or a workflow step that SSHes in and
runs `docker compose run --rm app <migrate-cmd>` before `up -d`. If pointing at an
already-migrated managed DB (e.g. you migrated hosts but kept the same DB), no
migration step is needed.
