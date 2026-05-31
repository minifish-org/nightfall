#!/usr/bin/env bash
# Apply the seat manifests in agents/ to an EXTERNAL agentd. This repo never
# modifies, forks, or embeds agentd — it only applies manifests to it.
#
# The seat manifests live here; the agentd-cli that applies them lives in the
# agentd repo. Point at the CLI however you have it:
#
#   AGENTD_CLI="cargo run --manifest-path /Users/yusp/work/agentd/Cargo.toml -p agentd-cli --"
#   # ...or, if you have an installed binary:
#   AGENTD_CLI="agentd-cli"
#
# No prerequisite wasm: the seat manifests use agentd's built-in native generic
# agent (artifact_uri = "builtin://generic-agent"); the persona + model live in
# each manifest. agentd just needs to be running with its tool catalog seeded.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTD_DIR="${AGENTD_DIR:-/Users/yusp/work/agentd}"
AGENTD_CLI="${AGENTD_CLI:-cargo run --manifest-path ${AGENTD_DIR}/Cargo.toml -p agentd-cli --}"

for manifest in "$ROOT_DIR"/agents/*.toml; do
  echo "==> apply ${manifest}"
  # shellcheck disable=SC2086
  $AGENTD_CLI apply --file "$manifest"
done

echo "==> all seat manifests applied"
