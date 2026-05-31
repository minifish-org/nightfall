#!/usr/bin/env bash
# Smoke-test one seat turn against a running agentd: POST /v1/turns with a
# sample projected view and print the agent's final_decision. Use this to
# confirm the contract end-to-end before wiring the UI.
#
#   AGENTD_URL=http://127.0.0.1:8080 TENANT=demo AGENT_REF=werewolf-seer ./scripts/smoke-turn.sh
set -euo pipefail

AGENTD_URL="${AGENTD_URL:-http://127.0.0.1:8080}"
TENANT="${TENANT:-demo}"
AGENT_REF="${AGENT_REF:-werewolf-seer}"
SCOPE="${SCOPE:-game/smoke/seat/4}"

# A sample seer night view — exactly the shape the referee projects.
read -r -d '' PAYLOAD <<'JSON' || true
{
  "you": 4,
  "yourRole": "seer",
  "yourFaction": "town",
  "day": 1,
  "phase": "night",
  "alive": [1, 2, 3, 4, 5, 6],
  "seatCount": 6,
  "publicLog": [{ "kind": "game_start", "day": 1, "seats": 6, "board": "6p-standard" }],
  "legalActions": ["check"],
  "seerChecks": []
}
JSON

echo "==> POST ${AGENTD_URL}/v1/turns  (tenant=${TENANT} agent_ref=${AGENT_REF} scope=${SCOPE})"
curl -sS -X POST "${AGENTD_URL}/v1/turns" \
  -H 'content-type: application/json' \
  -d "$(cat <<JSON
{
  "tenant": "${TENANT}",
  "agent_ref": "${AGENT_REF}",
  "scope": "${SCOPE}",
  "payload": ${PAYLOAD},
  "wait": true,
  "timeout_ms": 30000
}
JSON
)" | { command -v jq >/dev/null 2>&1 && jq '{run_id, status, timed_out, final_decision: .output.final_decision}' || cat; }
