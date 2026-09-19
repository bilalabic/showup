/**
 * Toolchain smoke test.
 *
 * Verifies that the installed Stellar JavaScript toolchain actually works:
 *   1. @stellar/stellar-sdk can talk to Stellar RPC (testnet).
 *   2. The SEP-1 stellar.toml of the mock anchor can be resolved and parsed.
 *   3. @creit.tech/stellar-wallets-kit resolves through its exports map and is
 *      importable (type-only at compile time, DOM-free subpath at runtime).
 *
 * Exits with a non-zero status code on any failure.
 */
import { StellarToml, rpc } from "@stellar/stellar-sdk";
// Type-only import: proves the kit's type declarations resolve. No runtime cost,
// so the browser-only web components are never evaluated in Node.
import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";

const RPC_URL = "https://soroban-testnet.stellar.org";
const ANCHOR_DOMAIN = "tr-mock-anchor.fly.dev";

type KitConstructor = new (...args: ConstructorParameters<typeof StellarWalletsKit>) => StellarWalletsKit;

function log(label: string, value: unknown): void {
  console.log(`  ${label.padEnd(22)} ${value ?? "<missing>"}`);
}

async function main(): Promise<void> {
  console.log("[1/3] Stellar RPC:", RPC_URL);
  const server = new rpc.Server(RPC_URL);
  const [network, ledger] = await Promise.all([server.getNetwork(), server.getLatestLedger()]);
  log("passphrase", network.passphrase);
  log("protocol version", network.protocolVersion ?? ledger.protocolVersion);
  log("ledger sequence", ledger.sequence);
  if (!network.passphrase || typeof ledger.sequence !== "number") {
    throw new Error("RPC returned an incomplete network or ledger response");
  }

  console.log(`[2/3] Anchor stellar.toml: https://${ANCHOR_DOMAIN}/.well-known/stellar.toml`);
  const toml = await StellarToml.Resolver.resolve(ANCHOR_DOMAIN);
  log("WEB_AUTH_ENDPOINT", toml.WEB_AUTH_ENDPOINT);
  log("TRANSFER_SERVER", toml.TRANSFER_SERVER);
  log("KYC_SERVER", toml.KYC_SERVER);
  log("ANCHOR_QUOTE_SERVER", toml.ANCHOR_QUOTE_SERVER);
  const usdc = toml.CURRENCIES?.find((currency) => currency.code === "USDC");
  log("USDC issuer", usdc?.issuer);
  if (!toml.WEB_AUTH_ENDPOINT || !toml.TRANSFER_SERVER || !usdc?.issuer) {
    throw new Error("Anchor stellar.toml is missing WEB_AUTH_ENDPOINT, TRANSFER_SERVER or the USDC issuer");
  }

  console.log("[3/3] Stellar Wallets Kit import check");
  // The DOM-free `/types` subpath carries the runtime enums, so it can be loaded
  // in Node while still exercising the package's exports map.
  const kitTypes = await import("@creit.tech/stellar-wallets-kit/types");
  log("kit Networks.TESTNET", kitTypes.Networks.TESTNET);
  log("kit ModuleType keys", Object.keys(kitTypes.ModuleType).join(", "));
  if (kitTypes.Networks.TESTNET !== network.passphrase) {
    throw new Error("Wallets kit TESTNET passphrase does not match the RPC network passphrase");
  }
  // Compile-time only: asserts the kit's main entry point is type-resolvable.
  const _kitCtorCheck: KitConstructor | undefined = undefined;
  void _kitCtorCheck;

  console.log("SMOKE TEST PASSED");
}

main().catch((error: unknown) => {
  console.error("SMOKE TEST FAILED");
  console.error(error);
  process.exitCode = 1;
});
