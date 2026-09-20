/**
 * Toolchain smoke test.
 *
 * Verifies that the installed Stellar JavaScript toolchain actually works:
 *   1. @stellar/stellar-sdk can talk to Stellar RPC (testnet).
 *   2. The SEP-1 stellar.toml of the mock anchor can be resolved and parsed.
 *   3. The Anchor health and public SEP-38 pricing endpoints answer coherently.
 *   4. @creit.tech/stellar-wallets-kit resolves through its exports map and is
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
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

type KitConstructor = new (...args: ConstructorParameters<typeof StellarWalletsKit>) => StellarWalletsKit;

function log(label: string, value: unknown): void {
  console.log(`  ${label.padEnd(22)} ${value ?? "<missing>"}`);
}

async function main(): Promise<void> {
  console.log("[1/4] Stellar RPC:", RPC_URL);
  const server = new rpc.Server(RPC_URL);
  const [network, ledger] = await Promise.all([server.getNetwork(), server.getLatestLedger()]);
  log("passphrase", network.passphrase);
  log("protocol version", network.protocolVersion ?? ledger.protocolVersion);
  log("ledger sequence", ledger.sequence);
  if (!network.passphrase || typeof ledger.sequence !== "number") {
    throw new Error("RPC returned an incomplete network or ledger response");
  }

  console.log(`[2/4] Anchor stellar.toml: https://${ANCHOR_DOMAIN}/.well-known/stellar.toml`);
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

  console.log(`[3/4] Anchor health and public price`);
  const healthResponse = await fetch(`https://${ANCHOR_DOMAIN}/health`);
  if (!healthResponse.ok) {
    throw new Error(`Anchor health returned HTTP ${healthResponse.status}`);
  }
  const health = (await healthResponse.json()) as {
    ok?: unknown;
    network_passphrase?: unknown;
    asset?: { code?: unknown; issuer?: unknown };
    treasury?: { usdc_balance?: unknown; low_balance?: unknown };
    time?: unknown;
  };
  log("health ok", health.ok);
  log("health time", health.time);
  log("treasury USDC", health.treasury?.usdc_balance);
  log("treasury low", health.treasury?.low_balance);
  if (
    health.ok !== true ||
    health.network_passphrase !== network.passphrase ||
    health.asset?.code !== "USDC" ||
    health.asset?.issuer !== USDC_ISSUER
  ) {
    throw new Error("Anchor health does not match ShowUp's Testnet asset configuration");
  }

  const priceUrl = new URL(`https://${ANCHOR_DOMAIN}/sep38/price`);
  priceUrl.search = new URLSearchParams({
    sell_asset: "iso4217:TRY",
    buy_asset: `stellar:USDC:${USDC_ISSUER}`,
    sell_amount: "100.00",
    context: "sep6",
    sell_delivery_method: "bank_account",
  }).toString();
  const priceResponse = await fetch(priceUrl);
  if (!priceResponse.ok) {
    throw new Error(`Anchor public price returned HTTP ${priceResponse.status}`);
  }
  const price = (await priceResponse.json()) as {
    sell_amount?: unknown;
    buy_amount?: unknown;
  };
  log("100 TRY buys", `${String(price.buy_amount)} USDC`);
  if (price.sell_amount !== "100.00" || typeof price.buy_amount !== "string") {
    throw new Error("Anchor public price returned an unusable response");
  }

  console.log("[4/4] Stellar Wallets Kit import check");
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
