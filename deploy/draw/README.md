# Deno production candidate

Source of the current React drawing game, isolated from the historical root Next.js app.
Runtime: Deno + transactional KV; frontend: React/Vite. Never store runtime KV data or credentials here.

- `npm ci && npm run typecheck && npm run build`
- `deno test -A --unstable-kv tests/`
- Production app: `deadmau5v/draw-d5v`
- Deployment branch: `deploy/deno`; workflow `.github/workflows/draw-deno.yml`.
- The repository secret `DRAW_DENO_DEPLOY_TOKEN` is injected only into the deployment step.
- The native GitHub App is not authorized yet; Actions is the explicit fallback.
- `draw.d5v.cc` is NOT cut over until DNS challenge/certificate and idle maintenance gates pass.

KV keys are split into room, sequence, summary, used words, bounded event/chat and per-turn drawing records. OCC prevents concurrent score/turn updates. Resync only emits drawing records up to its snapshot sequence. Local tests explicitly route two processes to a shared database and kill/restart one; this does not claim every cloud eviction condition is reproduced.

Rollback: keep RC backend and previous Deno revision. Do not restore a stale state snapshot. DNS propagation must not create two writers: switch lisa's draw-only cached-DNS ingress to the same Deno application before updating DNS. Never stop other services.
