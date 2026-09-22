# Deploying Nightfall to Cloudflare Pages

Nightfall is a **static SPA**: the referee runs entirely in the browser and
agentd is an external HTTPS service. There is **no server/Worker to deploy** —
`pnpm build` → `dist/` → Cloudflare Pages serves it. (A Cloudflare Durable
Object for server-side authority is a *future* milestone for untrusting human
players; the current all-AI spectator does not need it.)

## ⚠️ The one real prerequisite: agentd must be HTTPS

A Pages site is served over **HTTPS**, and browsers block an HTTPS page from
calling `http://` or `localhost` URLs (**mixed content**). So the local
`http://127.0.0.1:8080` agentd is unreachable from a deployed page — agentd needs
an HTTPS URL with a valid cert.

**Recommended (tailnet-only): `tailscale serve`.** If you play from a device in
your own tailnet, you do NOT need to expose agentd to the public internet:

```bash
tailscale serve --bg 8080          # → https://<machine>.<tailnet>.ts.net (valid *.ts.net cert)
```

- From a device **in your tailnet** the `*.ts.net` name resolves (MagicDNS),
  routes over WireGuard, and has a real HTTPS cert → Test connection goes green,
  no mixed-content / cert warnings.
- From outside the tailnet it doesn't resolve/route → **agentd stays private**.

Net effect: the static UI is public on Pages, but agentd and the whole game only
work from your tailnet devices (token adds another layer). Use this, not Funnel.

The checked-in default is `http://127.0.0.1:8080`. Set your own endpoint in
Settings or with `VITE_AGENTD_BASE_URL`; no maintainer deployment is bundled.

**Only if you want it reachable outside your tailnet:** `tailscale funnel 8080`
(public), `cloudflared tunnel --url http://127.0.0.1:8080`, or a TLS reverse
proxy — then anyone with the URL + token can play.

Configure your agentd deployment to allow the browser origin and Authorization
header. CORS behavior depends on the agentd version and deployment. Keep agentd auth ON (`api_token`);
users enter the token in **Settings** (stored only in their browser's localStorage).

## Deploy

Build settings (dashboard Git integration — recommended):

| Setting          | Value        |
| ---------------- | ------------ |
| Framework preset | None / Vite  |
| Build command    | `pnpm build` |
| Output directory | `dist`       |
| Node version     | `22` (pinned by `.node-version`) |

pnpm is auto-detected from `packageManager` in `package.json` + the lockfile.

Manual deploy (no Git): `pnpm build && npx wrangler pages deploy dist`
(uses `wrangler.toml`; `npx` fetches wrangler, no devDependency needed).

## Runtime config (no rebuild needed)

Two ways to point the deployed app at your agentd:

1. **Per-user (default, most flexible):** the user opens **Settings**, confirms
   the pre-filled agentd HTTPS baseUrl, and enters the token + tenant; it
   persists to localStorage.
2. **Baked default baseUrl:** set a Pages **build env var**
   `VITE_AGENTD_BASE_URL=https://<machine>.<tailnet>.ts.net` (and optionally
   `VITE_AGENTD_TENANT=werewolf`) so Settings is pre-filled with your tailnet
   agentd. The hostname isn't secret (it only resolves/routes inside your
   tailnet), so it's safe to bake.

**Never set `VITE_AGENTD_TOKEN` as a build env var** — Vite inlines `VITE_*`
into the public bundle, which would leak the token. The token is user-entered
only.

## Checklist

- [ ] agentd on **HTTPS** — `tailscale serve --bg 8080` (tailnet-only,
      recommended) or a public tunnel if you need outside access
- [ ] play from a device in your tailnet (so the `*.ts.net` host resolves)
- [ ] agentd auth on; share the token out-of-band (not in the build)
- [ ] `werewolf-seer`, `werewolf-villager`, `werewolf-wolf`, and
      `werewolf-judge` registered in the target tenant by the agentd deployment
- [ ] Pages project: build `pnpm build`, output `dist`, Node 22
- [ ] (optional) `VITE_AGENTD_BASE_URL` build var for a pre-filled URL
- [ ] open the deployed URL → Settings → Test connection → green → play
