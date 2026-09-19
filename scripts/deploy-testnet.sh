#!/usr/bin/env bash
#
# Build, deploy, verify and generate bindings for ShowUp on Stellar Testnet.
#
# Usage:
#   ./scripts/deploy-testnet.sh
#   ./scripts/deploy-testnet.sh --dry-run
#
# Testnet only. Secret keys remain in the Stellar CLI keystore.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
cd "$REPO_ROOT"

NETWORK="testnet"
EXPECTED_PASSPHRASE="Test SDF Network ; September 2015"
EXPECTED_PROTOCOL="28"
RPC_URL="https://soroban-testnet.stellar.org"
HORIZON_URL="https://horizon-testnet.stellar.org"
TOKEN_CONTRACT_ID="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
CONTRACT_PACKAGE="showup-bond"
WASM_NAME="${CONTRACT_PACKAGE//-/_}.wasm"
WASM_PATH="target/wasm32v1-none/release/${WASM_NAME}"
BINDINGS_DIR="packages/showup-bond-client"
DEPLOY_IDENTITY="${STELLAR_DEPLOY_IDENTITY:-showup-deployer}"
POOL_IDENTITY="${STELLAR_COMMUNITY_POOL_IDENTITY:-showup-community-pool}"
ALIAS="showup-bond"
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) echo "error: unknown argument '$arg'" >&2; exit 2 ;;
  esac
done

die() { echo "error: $*" >&2; exit 1; }

validate_identity_alias() {
  local alias="$1"
  local label="$2"
  [[ "$alias" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] \
    || die "${label} must be a Stellar CLI identity alias, not a key or seed phrase"
  [[ ! "$alias" =~ ^S[A-Z2-7]{55}$ ]] \
    || die "${label} must not be a secret key"
}

validate_identity_alias "$DEPLOY_IDENTITY" "STELLAR_DEPLOY_IDENTITY"
validate_identity_alias "$POOL_IDENTITY" "STELLAR_COMMUNITY_POOL_IDENTITY"

# Never let inherited CLI configuration override the Testnet values verified
# below. Every networked Stellar command also receives explicit RPC/passphrase
# arguments as a second line of defence.
unset STELLAR_RPC_URL STELLAR_RPC_HEADERS STELLAR_NETWORK_PASSPHRASE
unset STELLAR_NETWORK STELLAR_ACCOUNT STELLAR_CONTRACT_ID STELLAR_SEND

NETWORK_ARGS=(
  --network "$NETWORK"
  --rpc-url "$RPC_URL"
  --network-passphrase "$EXPECTED_PASSPHRASE"
)

for tool in stellar curl sed grep sha256sum cut tail head mktemp tee wc tr date; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool not found on PATH"
done

echo "==> Stellar CLI: $(stellar --version | head -n1)"
echo "==> Network:     ${NETWORK}"
echo "==> Deployer:    ${DEPLOY_IDENTITY}"
echo "==> Pool:        ${POOL_IDENTITY}"
echo

# Live passphrase and protocol checks make an accidental Mainnet deployment
# impossible and expose a protocol/toolchain mismatch before any transaction.
echo "==> Checking ${RPC_URL}"
RPC_INFO="$(curl -sS -m 20 -X POST "$RPC_URL" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getNetwork"}')" \
  || die "could not reach Stellar RPC at ${RPC_URL}"

extract_json_string() { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" <<<"$RPC_INFO"; }
extract_json_number() { sed -n "s/.*\"$1\":\([0-9]*\).*/\1/p" <<<"$RPC_INFO"; }

LIVE_PASSPHRASE="$(extract_json_string passphrase)"
LIVE_PROTOCOL="$(extract_json_number protocolVersion)"

[ "$LIVE_PASSPHRASE" = "$EXPECTED_PASSPHRASE" ] \
  || die "network passphrase mismatch; refusing to deploy"
[ "$LIVE_PROTOCOL" = "$EXPECTED_PROTOCOL" ] \
  || die "expected protocol ${EXPECTED_PROTOCOL}, got ${LIVE_PROTOCOL}; re-check the pinned SDK"

echo "    passphrase:       ${LIVE_PASSPHRASE}"
echo "    protocol version: ${LIVE_PROTOCOL}"
echo

# Both addresses are loaded from the same WSL keystore used for signing. Only
# public keys are printed; secrets never enter the process environment.
stellar keys public-key "$DEPLOY_IDENTITY" >/dev/null 2>&1 \
  || die "identity '${DEPLOY_IDENTITY}' is missing; run ./scripts/setup-identities.sh --fund"
stellar keys public-key "$POOL_IDENTITY" >/dev/null 2>&1 \
  || die "identity '${POOL_IDENTITY}' is missing; run ./scripts/setup-identities.sh --fund"

DEPLOYER_ADDRESS="$(stellar keys public-key "$DEPLOY_IDENTITY")"
POOL_ADDRESS="$(stellar keys public-key "$POOL_IDENTITY")"

for address in "$DEPLOYER_ADDRESS" "$POOL_ADDRESS"; do
  ACCOUNT_STATUS="$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "${HORIZON_URL}/accounts/${address}")" \
    || die "could not reach Horizon at ${HORIZON_URL}"
  [ "$ACCOUNT_STATUS" = "200" ] \
    || die "account ${address} is not funded on ${NETWORK} (HTTP ${ACCOUNT_STATUS})"
done

echo "==> Constructor inputs"
echo "    token:          ${TOKEN_CONTRACT_ID}"
echo "    community pool: ${POOL_ADDRESS}"
echo

# Probe the pinned SAC instead of assuming that derivation implies deployment.
echo "==> Verifying the pinned Mock USDC SAC"
stellar contract info interface \
  --contract-id "$TOKEN_CONTRACT_ID" \
  "${NETWORK_ARGS[@]}" \
  --output json >/dev/null \
  || die "Mock USDC SAC ${TOKEN_CONTRACT_ID} is not readable on ${NETWORK}"
echo "    interface available"
echo

echo "==> Building ${CONTRACT_PACKAGE}"
stellar contract build --package "$CONTRACT_PACKAGE"
[ -f "$WASM_PATH" ] || die "expected artifact not found at ${WASM_PATH}"
echo "    artifact: ${WASM_PATH} ($(wc -c <"$WASM_PATH" | tr -d ' ') bytes)"
echo

if [ "$DRY_RUN" = true ]; then
  echo "==> --dry-run: every check passed; no network write or binding regeneration occurred."
  exit 0
fi

echo "==> Deploying with constructor arguments"
DEPLOY_LOG="$(mktemp)"
SMOKE_LOG="$(mktemp)"
cleanup_logs() {
  rm -f -- "$DEPLOY_LOG" "$SMOKE_LOG"
}
trap cleanup_logs EXIT

CONTRACT_ID="$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source-account "$DEPLOY_IDENTITY" \
  "${NETWORK_ARGS[@]}" \
  --alias "$ALIAS" \
  -- \
  --token "$TOKEN_CONTRACT_ID" \
  --community_pool "$POOL_ADDRESS" \
  2> >(tee "$DEPLOY_LOG" >&2))"

[[ "$CONTRACT_ID" =~ ^C[A-Z2-7]{55}$ ]] \
  || die "deploy did not return a valid contract id: '${CONTRACT_ID}'"

mapfile -t DEPLOY_TX_HASHES < <(
  sed -n -E 's/.*Signing transaction: ([0-9a-f]{64}).*/\1/p' "$DEPLOY_LOG"
)
[ "${#DEPLOY_TX_HASHES[@]}" -ge 1 ] \
  || die "could not capture the contract deployment transaction hash"
DEPLOY_TX_HASH="${DEPLOY_TX_HASHES[$((${#DEPLOY_TX_HASHES[@]} - 1))]}"
UPLOAD_TX_HASH=""
if [ "${#DEPLOY_TX_HASHES[@]}" -ge 2 ]; then
  UPLOAD_TX_HASH="${DEPLOY_TX_HASHES[0]}"
fi

echo "    contract id: ${CONTRACT_ID}"
echo "    deploy tx:   ${DEPLOY_TX_HASH}"
echo

echo "==> Verifying constructor state"
CONFIG_OUTPUT="$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$DEPLOY_IDENTITY" \
  "${NETWORK_ARGS[@]}" \
  --send=no \
  -- get_config)"
grep -Fq "$TOKEN_CONTRACT_ID" <<<"$CONFIG_OUTPUT" \
  || die "get_config did not return the pinned token"
grep -Fq "$POOL_ADDRESS" <<<"$CONFIG_OUTPUT" \
  || die "get_config did not return the pinned community pool"
echo "    get_config: ${CONFIG_OUTPUT}"
echo

# C4 acceptance includes a real write invocation. The short-lived smoke event is
# explicitly a Testnet fixture and uses a small integer-unit bond.
NOW="$(date +%s)"
CANCELLATION_DEADLINE="$((NOW + 300))"
CHECKIN_START="$((NOW + 600))"
START_TIME="$((NOW + 900))"
CHECKIN_DEADLINE="$((NOW + 1200))"

echo "==> Creating a Testnet smoke event"
EVENT_ID="$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$DEPLOY_IDENTITY" \
  "${NETWORK_ARGS[@]}" \
  --send=yes \
  -- create_event \
  --organizer "$DEPLOYER_ADDRESS" \
  --title "C4 Testnet Smoke Event" \
  --venue "Istanbul" \
  --bond_amount 1000000 \
  --capacity 5 \
  --start_time "$START_TIME" \
  --checkin_start "$CHECKIN_START" \
  --checkin_deadline "$CHECKIN_DEADLINE" \
  --cancellation_deadline "$CANCELLATION_DEADLINE" \
  --organizer_bps 8000 \
  --community_bps 2000 \
  2> >(tee "$SMOKE_LOG" >&2))"

[ "$EVENT_ID" = "1" ] || die "expected first event id 1, got '${EVENT_ID}'"
SMOKE_TX_HASH="$(sed -n -E 's/.*Signing transaction: ([0-9a-f]{64}).*/\1/p' "$SMOKE_LOG" | tail -n1)"
[[ "$SMOKE_TX_HASH" =~ ^[0-9a-f]{64}$ ]] \
  || die "could not capture the smoke-event transaction hash"
echo "    event id: ${EVENT_ID}"
echo "    smoke tx: ${SMOKE_TX_HASH}"

EVENT_OUTPUT="$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$DEPLOY_IDENTITY" \
  "${NETWORK_ARGS[@]}" \
  --send=no \
  -- get_event \
  --event_id "$EVENT_ID")"
grep -Fq "C4 Testnet Smoke Event" <<<"$EVENT_OUTPUT" \
  || die "get_event did not return the smoke fixture"
echo "    get_event verified"
echo

echo "==> Generating TypeScript bindings from the deployed contract"
stellar contract bindings typescript \
  --contract-id "$CONTRACT_ID" \
  "${NETWORK_ARGS[@]}" \
  --output-dir "$BINDINGS_DIR" \
  --overwrite

PACKAGE_JSON="$BINDINGS_DIR/package.json"
GENERATED_README="$BINDINGS_DIR/README.md"
grep -Fq '"@stellar/stellar-sdk"' "$PACKAGE_JSON" \
  || die "generated package does not declare @stellar/stellar-sdk"
sed -i -E 's#("@stellar/stellar-sdk"[[:space:]]*:[[:space:]]*)"[^"]+"#\1"^17.1.0"#' "$PACKAGE_JSON"
grep -Fq '"@stellar/stellar-sdk": "^17.1.0"' "$PACKAGE_JSON" \
  || die "failed to align the generated Stellar SDK dependency"

# CLI 28 still emits a legacy README example. Keep the generated documentation
# executable and scoped to the one network actually embedded in this client.
sed -i 's/soroban contract bindings ts/stellar contract bindings typescript/g' "$GENERATED_README"
sed -i 's/automatically generated by Soroban CLI/automatically generated by Stellar CLI/' "$GENERATED_README"
sed -i '/# To publish or not to publish/,/# Use it/{ /# Use it/!d; }' "$GENERATED_README"
sed -i 's/networks\.futurenet/networks.testnet/' "$GENERATED_README"
sed -i 's/import { Contract, networks }/import { Client, networks }/' "$GENERATED_README"
sed -i 's/const contract = new Contract/const contract = new Client/' "$GENERATED_README"
sed -i 's/contract.|/contract.get_event_count()/' "$GENERATED_README"
sed -i '/As long as your editor is configured/,/original source code\./c\The generated `Client` exposes one typed method for each contract entry point.' "$GENERATED_README"

echo "==> Installing and building generated bindings"
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
  pnpm bindings:build
elif [ -x /mnt/c/Windows/System32/cmd.exe ] && command -v wslpath >/dev/null 2>&1; then
  WINDOWS_REPO_ROOT="$(wslpath -w "$REPO_ROOT")"
  /mnt/c/Windows/System32/cmd.exe /d /s /c \
    "cd /d ${WINDOWS_REPO_ROOT} && pnpm install && pnpm bindings:build"
else
  die "pnpm is required to install and build generated bindings"
fi

[ -f "$BINDINGS_DIR/dist/index.js" ] \
  || die "generated JavaScript binding was not built"
[ -f "$BINDINGS_DIR/dist/index.d.ts" ] \
  || die "generated TypeScript declarations were not built"

grep -R -Fq "$CONTRACT_ID" "$BINDINGS_DIR" \
  || die "generated bindings do not contain the deployed contract id"
echo "    output: ${BINDINGS_DIR}"
echo "    @stellar/stellar-sdk: ^17.1.0"
echo "    dist/index.js and dist/index.d.ts verified"
echo

echo "==> Recording deployment evidence"
WASM_HASH="$(sha256sum "$WASM_PATH" | cut -d' ' -f1)"
WASM_SIZE="$(wc -c <"$WASM_PATH" | tr -d ' ')"
DEPLOY_DATE="$(date -u +%F)"
DEPLOYMENT_RECORD="docs/deployments/testnet.md"
RECORDED_WASM_HASH="$(sed -n -E 's#^  `([0-9a-f]{64})`$#\1#p' "$DEPLOYMENT_RECORD" | head -n1)"
RECORDED_UPLOAD_TX="$(
  grep -E '^\| Upload Wasm \|' "$DEPLOYMENT_RECORD" \
    | grep -oE '[0-9a-f]{64}' \
    | tail -n1 \
    || true
)"

sed -i -E \
  "s#^NEXT_PUBLIC_SHOWUP_CONTRACT_ID=.*#NEXT_PUBLIC_SHOWUP_CONTRACT_ID=${CONTRACT_ID}#" \
  .env.example
sed -i -E \
  "s#^NEXT_PUBLIC_COMMUNITY_POOL_ADDRESS=.*#NEXT_PUBLIC_COMMUNITY_POOL_ADDRESS=${POOL_ADDRESS}#" \
  .env.example
sed -i -E \
  "s#^\| Testnet contract ID \|.*#| Testnet contract ID | [${CONTRACT_ID}](https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}) |#" \
  README.md
sed -i -E \
  "s#^\| Contract deploy transaction \|.*#| Contract deploy transaction | [${DEPLOY_TX_HASH}](https://stellar.expert/explorer/testnet/tx/${DEPLOY_TX_HASH}) |#" \
  README.md
sed -i -E \
  "s#^\| C4 smoke event transaction \|.*#| C4 smoke event transaction | [${SMOKE_TX_HASH}](https://stellar.expert/explorer/testnet/tx/${SMOKE_TX_HASH}) |#" \
  README.md

EFFECTIVE_UPLOAD_TX="$UPLOAD_TX_HASH"
if [ -n "$UPLOAD_TX_HASH" ]; then
  sed -i -E \
    "s#^\| Wasm upload transaction \|.*#| Wasm upload transaction | [${UPLOAD_TX_HASH}](https://stellar.expert/explorer/testnet/tx/${UPLOAD_TX_HASH}) |#" \
    README.md
elif [ "$RECORDED_WASM_HASH" = "$WASM_HASH" ] \
  && [[ "$RECORDED_UPLOAD_TX" =~ ^[0-9a-f]{64}$ ]]; then
  EFFECTIVE_UPLOAD_TX="$RECORDED_UPLOAD_TX"
else
  sed -i -E \
    's#^\| Wasm upload transaction \|.*#| Wasm upload transaction | cached before this run; transaction unavailable |#' \
    README.md
fi

sed -i -E \
  "s#^The current ShowUp contract was deployed to Stellar Testnet on [0-9-]+\.#The current ShowUp contract was deployed to Stellar Testnet on ${DEPLOY_DATE}.#" \
  "$DEPLOYMENT_RECORD"
sed -i -E \
  "s#^\| ShowUp contract \|.*#| ShowUp contract | \`${CONTRACT_ID}\` |#" \
  "$DEPLOYMENT_RECORD"
sed -i -E \
  "s#^\| Community pool \|.*#| Community pool | \`${POOL_ADDRESS}\` |#" \
  "$DEPLOYMENT_RECORD"
sed -i -E \
  "s#^\| Deployer / smoke-event organizer \|.*#| Deployer / smoke-event organizer | \`${DEPLOYER_ADDRESS}\` |#" \
  "$DEPLOYMENT_RECORD"
sed -i -E \
  "s#^- Optimized size: .*#- Optimized size: ${WASM_SIZE} bytes#" \
  "$DEPLOYMENT_RECORD"
sed -i -E 's#^  `[0-9a-f]{64}`$#  `'$WASM_HASH'`#' "$DEPLOYMENT_RECORD"
sed -i -E \
  "s#^\| Deploy with constructor \|.*#| Deploy with constructor | [${DEPLOY_TX_HASH}](https://stellar.expert/explorer/testnet/tx/${DEPLOY_TX_HASH}) |#" \
  "$DEPLOYMENT_RECORD"
sed -i -E \
  "s#^\| Create C4 smoke event \|.*#| Create C4 smoke event | [${SMOKE_TX_HASH}](https://stellar.expert/explorer/testnet/tx/${SMOKE_TX_HASH}) |#" \
  "$DEPLOYMENT_RECORD"

if [ -n "$UPLOAD_TX_HASH" ]; then
  sed -i -E \
    "s#^\| Upload Wasm \|.*#| Upload Wasm | [${UPLOAD_TX_HASH}](https://stellar.expert/explorer/testnet/tx/${UPLOAD_TX_HASH}) |#" \
    "$DEPLOYMENT_RECORD"
elif [ "$RECORDED_WASM_HASH" != "$WASM_HASH" ] \
  || [[ ! "$RECORDED_UPLOAD_TX" =~ ^[0-9a-f]{64}$ ]]; then
  sed -i -E \
    's#^\| Upload Wasm \|.*#| Upload Wasm | cached before this run; transaction unavailable |#' \
    "$DEPLOYMENT_RECORD"
fi

grep -Fxq "NEXT_PUBLIC_SHOWUP_CONTRACT_ID=${CONTRACT_ID}" .env.example \
  || die "failed to record the active contract id in .env.example"
grep -Fxq "NEXT_PUBLIC_COMMUNITY_POOL_ADDRESS=${POOL_ADDRESS}" .env.example \
  || die "failed to record the community pool in .env.example"
grep -Eq "^\| Testnet contract ID \| .*contract/${CONTRACT_ID}\) \|$" README.md \
  || die "failed to record the active contract id in README.md"
grep -Eq "^\| Contract deploy transaction \| .*tx/${DEPLOY_TX_HASH}\) \|$" README.md \
  || die "failed to record the deploy transaction in README.md"
grep -Eq "^\| C4 smoke event transaction \| .*tx/${SMOKE_TX_HASH}\) \|$" README.md \
  || die "failed to record the smoke transaction in README.md"
grep -Fxq "The current ShowUp contract was deployed to Stellar Testnet on ${DEPLOY_DATE}." "$DEPLOYMENT_RECORD" \
  || die "failed to record the deployment date"
grep -Fxq "| ShowUp contract | \`${CONTRACT_ID}\` |" "$DEPLOYMENT_RECORD" \
  || die "failed to record the active contract id in ${DEPLOYMENT_RECORD}"
grep -Fxq "| Community pool | \`${POOL_ADDRESS}\` |" "$DEPLOYMENT_RECORD" \
  || die "failed to record the community pool in ${DEPLOYMENT_RECORD}"
grep -Fxq "| Deployer / smoke-event organizer | \`${DEPLOYER_ADDRESS}\` |" "$DEPLOYMENT_RECORD" \
  || die "failed to record the deployer in ${DEPLOYMENT_RECORD}"
grep -Fxq -- "- Optimized size: ${WASM_SIZE} bytes" "$DEPLOYMENT_RECORD" \
  || die "failed to record the Wasm size"
grep -Fxq "  \`${WASM_HASH}\`" "$DEPLOYMENT_RECORD" \
  || die "failed to record the Wasm hash"
grep -Eq "^\| Deploy with constructor \| .*tx/${DEPLOY_TX_HASH}\) \|$" "$DEPLOYMENT_RECORD" \
  || die "failed to record the deploy transaction in ${DEPLOYMENT_RECORD}"
grep -Eq "^\| Create C4 smoke event \| .*tx/${SMOKE_TX_HASH}\) \|$" "$DEPLOYMENT_RECORD" \
  || die "failed to record the smoke transaction in ${DEPLOYMENT_RECORD}"

if [ -n "$EFFECTIVE_UPLOAD_TX" ]; then
  grep -Eq "^\| Wasm upload transaction \| .*tx/${EFFECTIVE_UPLOAD_TX}\) \|$" README.md \
    || die "failed to record the Wasm upload transaction in README.md"
  grep -Eq "^\| Upload Wasm \| .*tx/${EFFECTIVE_UPLOAD_TX}\) \|$" "$DEPLOYMENT_RECORD" \
    || die "failed to record the Wasm upload transaction in ${DEPLOYMENT_RECORD}"
else
  grep -Fxq "| Wasm upload transaction | cached before this run; transaction unavailable |" README.md \
    || die "failed to record the cached Wasm state in README.md"
  grep -Fxq "| Upload Wasm | cached before this run; transaction unavailable |" "$DEPLOYMENT_RECORD" \
    || die "failed to record the cached Wasm state in ${DEPLOYMENT_RECORD}"
fi
echo "    active records updated"
echo

echo "==> C4 complete"
echo "    Contract: https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}"
echo "    NEXT_PUBLIC_SHOWUP_CONTRACT_ID=${CONTRACT_ID}"
echo "    NEXT_PUBLIC_COMMUNITY_POOL_ADDRESS=${POOL_ADDRESS}"
