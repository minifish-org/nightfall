#!/usr/bin/env bash
# Smoke-test one character turn against a running agentd: POST /v1/turns with a
# sample projected roleplay view and print the agent's final_decision. Use this to
# confirm the contract end-to-end before wiring the UI.
#
#   AGENTD_URL=http://127.0.0.1:8080 TENANT=demo AGENT_REF=werewolf-seer ./scripts/smoke-turn.sh
set -euo pipefail

AGENTD_URL="${AGENTD_URL:-http://127.0.0.1:8080}"
TENANT="${TENANT:-demo}"
AGENT_REF="${AGENT_REF:-werewolf-seer}"
SCOPE="${SCOPE:-game/smoke/player/nahida}"

# A sample seer night view — the roleplay shape sent as payload.input.
read -r -d '' PAYLOAD <<'JSON' || true
{
  "input": {
    "phase": "night_seer",
    "game_id": "smoke",
    "day": 1,
    "you": { "role": "seer", "character": { "id": "nahida", "zh": "纳西妲", "en": "Nahida" } },
    "setup": { "seats": 6, "wolves": 2, "seers": 1, "villagers": 3 },
    "alive_characters": [
      { "id": "venti", "zh": "温迪", "en": "Venti" },
      { "id": "zhongli", "zh": "钟离", "en": "Zhongli" },
      { "id": "raiden_shogun", "zh": "雷电将军", "en": "Raiden Shogun" },
      { "id": "nahida", "zh": "纳西妲", "en": "Nahida" },
      { "id": "furina", "zh": "芙宁娜", "en": "Furina" },
      { "id": "mavuika", "zh": "玛薇卡", "en": "Mavuika" }
    ],
    "dead_characters": [],
    "public_log": [],
    "private": { "checks": [] },
    "valid_targets": [
      { "id": "venti", "zh": "温迪", "en": "Venti" },
      { "id": "zhongli", "zh": "钟离", "en": "Zhongli" },
      { "id": "raiden_shogun", "zh": "雷电将军", "en": "Raiden Shogun" },
      { "id": "furina", "zh": "芙宁娜", "en": "Furina" },
      { "id": "mavuika", "zh": "玛薇卡", "en": "Mavuika" }
    ],
    "roleplay": {
      "target_format": "character_id",
      "instruction": "你正在扮演纳西妲。公开发言请称呼其他玩家的角色名,不要使用座位号。如果需要选择目标,target 必须严格填写 valid_targets[].id 里的一个 id。"
    },
    "lang": "zh"
  }
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
