# Readiness / liveness snippets by framework

Pattern in every stack: a cheap `/healthz` (liveness, no deps) and a `/readyz`
(readiness, touches the DB + required config). Bind to `0.0.0.0`. Return 200 only when
the dependency check truly passes; 503 otherwise.

## Node.js (Express)

```js
app.get("/healthz", (_req, res) => res.status(200).send("healthy")); // liveness

app.get("/readyz", async (_req, res) => {                            // readiness
  try {
    await db.query("SELECT 1");                 // real round-trip
    if (!process.env.DATABASE_URL) throw new Error("missing DATABASE_URL");
    res.status(200).send("healthy");
  } catch (e) {
    res.status(503).send("unhealthy: " + e.message);
  }
});
```
Prisma: `await prisma.$queryRaw\`SELECT 1\``. Use a 1-2s timeout on the query.

## Python (FastAPI)

```python
@app.get("/healthz")
async def live(): return PlainTextResponse("healthy")

@app.get("/readyz")
async def ready():
    try:
        await database.execute("SELECT 1")
        return PlainTextResponse("healthy")
    except Exception as e:
        return PlainTextResponse(f"unhealthy: {e}", status_code=503)
```
Django: `django-health-check` package, or a view running `connection.cursor().execute("SELECT 1")`.

## Go

```go
mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
    w.Write([]byte("healthy"))
})
mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
    defer cancel()
    if err := db.PingContext(ctx); err != nil {
        http.Error(w, "unhealthy: "+err.Error(), http.StatusServiceUnavailable)
        return
    }
    w.Write([]byte("healthy"))
})
```

## .NET (ASP.NET Core)

```csharp
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy())          // liveness
    .AddNpgSql(connString, name: "db");                           // readiness (real connect)

app.MapHealthChecks("/healthz", new() { Predicate = c => c.Name == "self" });
app.MapHealthChecks("/readyz");   // includes db
```
Returns 200 "Healthy" / 503 "Unhealthy". Remember `AllowedHosts` rejects probes
without the right Host header.

## Deploy probe (CI) - the honest gate

Probe **readiness** after deploy; a curl sidecar avoids the no-curl-in-image problem and
carries the real Host header. Retry across the startup window, then assert the DB is
actually reachable (don't trust liveness alone):

```bash
for i in $(seq 1 25); do
  if docker run --rm --network "$NET" curlimages/curl -sf --max-time 5 \
       -H "Host: your.domain" http://app:8080/readyz | grep -qi '^healthy'; then
    echo ready; exit 0
  fi; sleep 6
done
echo "not ready"; docker compose logs --tail=60 app; exit 1
```

## Container HEALTHCHECK / compose

If the runtime image lacks curl/wget, disable the Dockerfile HEALTHCHECK
(`healthcheck: { disable: true }` in compose) and rely on the external probe, OR add a
tiny built-in checker. Give `start_period` enough room for boot + first DB connect so
the startup window doesn't flap.

## Kubernetes

```yaml
livenessProbe:  { httpGet: { path: /healthz, port: 8080 }, initialDelaySeconds: 10 }
readinessProbe: { httpGet: { path: /readyz,  port: 8080 }, periodSeconds: 5 }
```
Liveness on `/healthz` (no deps - a DB blip must not restart the pod); readiness on
`/readyz` (gates traffic).
