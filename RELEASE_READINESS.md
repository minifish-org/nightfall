# Public release preparation — 2026-09-22

## Validation

`pnpm test`: 77 passed. `pnpm build`: passed. `pnpm audit`: no known vulnerabilities at audit time. Browser smoke confirmed loopback default, empty token and rendered controls.

Gitleaks found no secrets in the fetched local Git history at preparation time.
This is a best-effort check, not a guarantee that every possible secret is detected.

## Scope and limitations

No live provider calls or complete live agentd game were performed. Tests cover the engine, projections, orchestration and HTTP client with mocks.

See README.md for license, setup and project status; SECURITY.md describes support
and private reporting. Third-party material retains its upstream license.
