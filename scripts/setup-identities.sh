#!/usr/bin/env bash
#
# Create the Stellar Testnet identities ShowUp needs.
#
# Usage:
#   ./scripts/setup-identities.sh           # create keys only
#   ./scripts/setup-identities.sh --fund    # create and fund them via friendbot
#
# Testnet only. Idempotent: existing identities are left alone.
#
# IMPORTANT — keystore boundary.
# The Stellar CLI keeps identities in ~/.config/stellar, and WSL has its own home
# directory. An identity created on Windows is invisible inside WSL and vice
# versa. Run this in the SAME environment that will run scripts/deploy-testnet.sh.
# On this project's Windows dev host that means WSL, because contract builds need
# a host C toolchain Windows does not have. See docs/phase-0-environment-audit.md
# discrepancy D6.
#
# Secret keys stay in the CLI keystore. They never enter .env or the repository.

set -euo pipefail

NETWORK="testnet"
DEPLOYER="${STELLAR_DEPLOY_IDENTITY:-showup-deployer}"
COMMUNITY_POOL="${STELLAR_COMMUNITY_POOL_IDENTITY:-showup-community-pool}"
FUND=false

for arg in "$@"; do
  case "$arg" in
    --fund) FUND=true ;;
    *) echo "error: unknown argument '$arg'" >&2; exit 2 ;;
  esac
done

command -v stellar >/dev/null 2>&1 || {
  echo "error: stellar CLI not found on PATH" >&2
  exit 1
}

echo "==> Stellar CLI:  $(stellar --version | head -n1)"
echo "==> Network:      ${NETWORK}"
echo "==> Keystore:     ${XDG_CONFIG_HOME:-$HOME/.config}/stellar/identity"
echo

ensure_identity() {
  local name="$1"
  if stellar keys public-key "$name" >/dev/null 2>&1; then
    echo "==> ${name}: already exists, leaving it alone"
  else
    stellar keys generate "$name" >/dev/null
    echo "==> ${name}: created"
  fi
}

# Friendbot creates and funds the account on Testnet. Funding an already funded
# account is a no-op that returns an error, so it is tolerated here.
fund_identity() {
  local name="$1"
  if stellar keys fund --network "$NETWORK" "$name" >/dev/null 2>&1; then
    echo "==> ${name}: funded via friendbot"
  else
    echo "==> ${name}: funding skipped (already funded, or friendbot declined)"
  fi
}

ensure_identity "$DEPLOYER"
ensure_identity "$COMMUNITY_POOL"

if [ "$FUND" = true ]; then
  echo
  fund_identity "$DEPLOYER"
  # The community pool only receives settlement transfers. It still needs to be a
  # funded account to hold a trustline and receive the asset.
  fund_identity "$COMMUNITY_POOL"
fi

DEPLOYER_ADDRESS="$(stellar keys public-key "$DEPLOYER")"
POOL_ADDRESS="$(stellar keys public-key "$COMMUNITY_POOL")"

echo
echo "==> Identities"
printf '    %-26s %s\n' "$DEPLOYER" "$DEPLOYER_ADDRESS"
printf '    %-26s %s\n' "$COMMUNITY_POOL" "$POOL_ADDRESS"
echo
echo "Add this to .env.local:"
echo "  NEXT_PUBLIC_COMMUNITY_POOL_ADDRESS=${POOL_ADDRESS}"
echo
if [ "$FUND" = false ]; then
  echo "These accounts do not exist on Testnet until they are funded."
  echo "Run again with --fund, or fund them manually:"
  echo "  stellar keys fund --network ${NETWORK} ${DEPLOYER}"
fi
