#!/usr/bin/env bash
#
# Seed a ShowUp event with compressed time windows for a live demo.
#
# Usage:
#   ./scripts/seed-demo-event.sh                 # standard demo event
#   ./scripts/seed-demo-event.sh --fast          # short check-in window, for the no-show path
#   ./scripts/seed-demo-event.sh --title "..."   # override the name
#
# The compression lives entirely in the event's schedule. The contract has no
# demo mode, no time override and no privileged entry point: every deadline is
# still enforced against the ledger clock exactly as it would be in production.
# See docs/architecture/SYSTEM.md section 10.
#
# Testnet only. Run in the environment that owns the Stellar CLI identities —
# WSL on the Windows dev host, because the keystore does not cross that boundary.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
cd "$REPO_ROOT"

NETWORK="testnet"
EXPECTED_PASSPHRASE="Test SDF Network ; September 2015"
RPC_URL="https://soroban-testnet.stellar.org"
IDENTITY="${STELLAR_DEPLOY_IDENTITY:-showup-deployer}"
TITLE="ShowUp Demo Meetup"
VENUE="Grand Pera, Beyoglu"
BOND="25000000"          # 2.5 USDC at 7 decimals
CAPACITY="5"
ORGANIZER_BPS="8000"
COMMUNITY_BPS="2000"
FAST=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --fast) FAST=true; shift ;;
    --title) TITLE="${2:?--title needs a value}"; shift 2 ;;
    --venue) VENUE="${2:?--venue needs a value}"; shift 2 ;;
    --bond) BOND="${2:?--bond needs a value}"; shift 2 ;;
    --capacity) CAPACITY="${2:?--capacity needs a value}"; shift 2 ;;
    *) echo "error: unknown argument '$1'" >&2; exit 2 ;;
  esac
done

die() { echo "error: $*" >&2; exit 1; }

for tool in stellar curl sed date; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool not found on PATH"
done

CONTRACT_ID="$(sed -n 's/^NEXT_PUBLIC_SHOWUP_CONTRACT_ID=//p' .env.example | tr -d '\r')"
[ -n "$CONTRACT_ID" ] || die "could not read NEXT_PUBLIC_SHOWUP_CONTRACT_ID from .env.example"

NETWORK_ARGS=(
  --network "$NETWORK"
  --rpc-url "$RPC_URL"
  --network-passphrase "$EXPECTED_PASSPHRASE"
)

# Refuse to run against anything but Testnet, on the same principle as the
# deploy script: the network is checked live, not assumed.
LIVE_PASSPHRASE="$(curl -sS -m 20 -X POST "$RPC_URL" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getNetwork"}' \
  | sed -n 's/.*"passphrase":"\([^"]*\)".*/\1/p')"
[ "$LIVE_PASSPHRASE" = "$EXPECTED_PASSPHRASE" ] \
  || die "network passphrase mismatch; refusing to seed"

stellar keys public-key "$IDENTITY" >/dev/null 2>&1 \
  || die "identity '${IDENTITY}' is missing; run ./scripts/setup-identities.sh --fund"
ORGANIZER="$(stellar keys public-key "$IDENTITY")"

NOW="$(date +%s)"

if [ "$FAST" = true ]; then
  # Check-in closes in two minutes, so a reservation made now becomes
  # settleable as a no-show during the demo rather than hours later.
  CANCELLATION_DEADLINE="$((NOW + 30))"
  CHECKIN_START="$((NOW + 30))"
  START_TIME="$((NOW + 60))"
  CHECKIN_DEADLINE="$((NOW + 150))"
  SHAPE="fast — check-in closes in 2.5 minutes"
else
  # Check-in is already open, so attendance can be demonstrated immediately.
  CANCELLATION_DEADLINE="$((NOW + 300))"
  CHECKIN_START="$((NOW + 300))"
  START_TIME="$((NOW + 600))"
  CHECKIN_DEADLINE="$((NOW + 1800))"
  SHAPE="standard — free cancellation for 5 minutes, check-in open for 25"
fi

echo "==> Contract:  ${CONTRACT_ID}"
echo "==> Organizer: ${ORGANIZER}"
echo "==> Schedule:  ${SHAPE}"
echo

EVENT_ID="$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$IDENTITY" \
  "${NETWORK_ARGS[@]}" \
  --send=yes \
  -- create_event \
  --organizer "$ORGANIZER" \
  --title "$TITLE" \
  --venue "$VENUE" \
  --bond_amount "$BOND" \
  --capacity "$CAPACITY" \
  --start_time "$START_TIME" \
  --checkin_start "$CHECKIN_START" \
  --checkin_deadline "$CHECKIN_DEADLINE" \
  --cancellation_deadline "$CANCELLATION_DEADLINE" \
  --organizer_bps "$ORGANIZER_BPS" \
  --community_bps "$COMMUNITY_BPS")"

EVENT_ID="$(tr -d '"' <<<"$EVENT_ID")"
[ -n "$EVENT_ID" ] || die "create_event did not return an event id"

echo
echo "==> Event #${EVENT_ID} created"
echo "    title:              ${TITLE}"
echo "    bond:               ${BOND} stroops"
echo "    capacity:           ${CAPACITY}"
echo "    no-show split:      ${ORGANIZER_BPS} / ${COMMUNITY_BPS} bps"
echo "    free cancel until:  $(date -d "@${CANCELLATION_DEADLINE}" '+%H:%M:%S' 2>/dev/null || echo "${CANCELLATION_DEADLINE}")"
echo "    check-in window:    $(date -d "@${CHECKIN_START}" '+%H:%M:%S' 2>/dev/null || echo "${CHECKIN_START}") - $(date -d "@${CHECKIN_DEADLINE}" '+%H:%M:%S' 2>/dev/null || echo "${CHECKIN_DEADLINE}")"
echo
echo "    Open it at /events/${EVENT_ID}"
