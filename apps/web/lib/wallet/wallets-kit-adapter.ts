"use client";

import type {
  StopWatchingWallet,
  Wallet,
  WalletError,
  WalletSnapshot,
} from "./port";
import {
  isWalletError,
  TESTNET_NETWORK_PASSPHRASE,
} from "./port";
import { isMobileWalletBrowser } from "./platform";

type WalletTransport = "freighter_extension" | "wallet_connect";

type KitRuntime = {
  kit: typeof import("@creit.tech/stellar-wallets-kit/sdk").StellarWalletsKit;
  transport: WalletTransport;
  freighter?: InstanceType<
    typeof import("@creit.tech/stellar-wallets-kit/modules/freighter").FreighterModule
  >;
  walletConnect?: InstanceType<
    typeof import("@creit.tech/stellar-wallets-kit/modules/wallet-connect").WalletConnectModule
  >;
};

let runtimePromise: Promise<KitRuntime> | null = null;

async function loadKit(): Promise<KitRuntime> {
  runtimePromise ??= (async () => {
    const [sdk, types] = await Promise.all([
      import("@creit.tech/stellar-wallets-kit/sdk"),
      import("@creit.tech/stellar-wallets-kit/types"),
    ]);

    if (isMobileWalletBrowser()) {
      const projectId =
        process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
      if (!projectId) {
        throw {
          kind: "mobile_wallet_unconfigured",
        } satisfies WalletError;
      }

      const walletConnectModule = await import(
        "@creit.tech/stellar-wallets-kit/modules/wallet-connect"
      );
      const walletConnect = new walletConnectModule.WalletConnectModule({
        projectId,
        allowedChains: [walletConnectModule.WalletConnectTargetChain.TESTNET],
        metadata: {
          name: "ShowUp",
          description: "Attendance commitment bonds on Stellar Testnet",
          url: window.location.origin,
          icons: [`${window.location.origin}/apple-touch-icon.svg`],
        },
      });

      sdk.StellarWalletsKit.init({
        modules: [walletConnect],
        selectedWalletId: walletConnectModule.WALLET_CONNECT_ID,
        network: types.Networks.TESTNET,
      });

      return {
        kit: sdk.StellarWalletsKit,
        transport: "wallet_connect" as const,
        walletConnect,
      };
    }

    const freighterModule = await import(
      "@creit.tech/stellar-wallets-kit/modules/freighter"
    );
    const freighter = new freighterModule.FreighterModule();

    sdk.StellarWalletsKit.init({
      modules: [freighter],
      selectedWalletId: freighterModule.FREIGHTER_ID,
      network: types.Networks.TESTNET,
    });

    return {
      kit: sdk.StellarWalletsKit,
      transport: "freighter_extension" as const,
      freighter,
    };
  })();

  return runtimePromise;
}

function getErrorDetails(error: unknown): {
  code?: number;
  message: string;
} {
  if (error instanceof Error) {
    return { message: error.message };
  }

  if (error && typeof error === "object") {
    const candidate = error as { code?: unknown; message?: unknown };
    return {
      code: typeof candidate.code === "number" ? candidate.code : undefined,
      message:
        typeof candidate.message === "string" ? candidate.message : "",
    };
  }

  return { message: "" };
}

export function toWalletError(error: unknown): WalletError {
  if (isWalletError(error)) {
    return error;
  }

  const { code, message } = getErrorDetails(error);
  const normalizedMessage = message.toLowerCase();

  if (
    code === -4 ||
    (code === -1 && normalizedMessage.includes("closed the modal")) ||
    normalizedMessage.includes("user rejected") ||
    normalizedMessage.includes("user declined")
  ) {
    return { kind: "rejected" };
  }

  if (
    (code === -3 && normalizedMessage.includes("set the wallet")) ||
    (code === -1 && normalizedMessage.includes("no wallet has been connected"))
  ) {
    return { kind: "not_connected" };
  }

  if (
    normalizedMessage.includes("freighter is not connected") ||
    normalizedMessage.includes("extension not found") ||
    normalizedMessage.includes("not installed")
  ) {
    return { kind: "no_wallet" };
  }

  return { kind: "unknown", cause: error };
}

function assertTestnet(network: string): void {
  if (network !== TESTNET_NETWORK_PASSPHRASE) {
    throw {
      kind: "wrong_network",
      actual: network,
      expected: TESTNET_NETWORK_PASSPHRASE,
    } satisfies WalletError;
  }
}

async function isFreighterAvailable(runtime: KitRuntime): Promise<boolean> {
  if (!runtime.freighter) return false;

  if (await runtime.freighter.isAvailable()) {
    return true;
  }

  // Freighter's own `isConnected()` resolves false after a 2s internal timeout
  // when the extension has not answered yet, so a cold extension can report
  // unavailable on the first call. One retry costs nothing and avoids a false
  // "not installed". (The Kit's 1s availability race lives in
  // `refreshSupportedWallets`, which this adapter never calls.)
  return runtime.freighter.isAvailable();
}

async function waitForWalletConnect(runtime: KitRuntime): Promise<void> {
  const walletConnect = runtime.walletConnect;
  if (!walletConnect) {
    throw { kind: "mobile_wallet_unconfigured" } satisfies WalletError;
  }

  // SignClient initialization starts in the module constructor. Avoid making
  // the first tap fail just because that asynchronous setup is still running.
  const deadline = Date.now() + 10_000;
  while (!(await walletConnect.isAvailable())) {
    if (Date.now() >= deadline) {
      throw new Error("WalletConnect did not become ready in time.");
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
}

// `getAddress` reads the Kit's cached address, which is hydrated from
// localStorage on load, so it survives a reload. `fetchAddress` would instead
// call into Freighter, which runs `requestAccess()` unless told not to — and
// this function is reached from the provider's focus-triggered refresh, so that
// would prompt for access every time the tab regains focus. The Kit's own
// guidance is to prefer `getAddress`.
async function readAddress(runtime: KitRuntime): Promise<string | null> {
  try {
    const { address } = await runtime.kit.getAddress();
    return address || null;
  } catch (error) {
    const walletError = toWalletError(error);

    if (
      walletError.kind === "no_wallet" ||
      walletError.kind === "not_connected"
    ) {
      return null;
    }

    throw walletError;
  }
}

async function readNetwork(runtime: KitRuntime): Promise<string> {
  // WalletConnect sessions are restricted to the Testnet chain when the
  // module is constructed. The module deliberately has no getNetwork API.
  if (runtime.transport === "wallet_connect") {
    return TESTNET_NETWORK_PASSPHRASE;
  }

  try {
    const { networkPassphrase } = await runtime.kit.getNetwork();
    return networkPassphrase;
  } catch (error) {
    throw toWalletError(error);
  }
}

export function createWalletsKitAdapter(): Wallet {
  return {
    async connect() {
      try {
        const runtime = await loadKit();

        if (runtime.transport === "wallet_connect") {
          await waitForWalletConnect(runtime);
          const { address } = await runtime.kit.fetchAddress();
          return address;
        }

        if (!(await isFreighterAvailable(runtime))) {
          throw { kind: "no_wallet" } satisfies WalletError;
        }

        // Only Freighter is registered on desktop, so a second wallet-picker
        // modal adds no choice. Fetching through the Kit opens Freighter's own
        // permission prompt directly and avoids rendering the Kit's internal
        // Twind UI (2.6.0 contains the invalid `easy-in-out` class).
        const { address } = await runtime.kit.fetchAddress();
        assertTestnet(await readNetwork(runtime));
        return address;
      } catch (error) {
        throw toWalletError(error);
      }
    },

    async disconnect() {
      try {
        const runtime = await loadKit();
        await runtime.kit.disconnect();
      } catch (error) {
        throw toWalletError(error);
      }
    },

    async getAddress() {
      return readAddress(await loadKit());
    },

    async getNetwork() {
      return readNetwork(await loadKit());
    },

    async signTransaction(xdr, expectedAddress) {
      try {
        const runtime = await loadKit();
        assertTestnet(await readNetwork(runtime));
        const address = expectedAddress ?? (await readAddress(runtime));
        if (!address) {
          throw { kind: "not_connected" } satisfies WalletError;
        }
        const { signedTxXdr, signerAddress } = await runtime.kit.signTransaction(xdr, {
          networkPassphrase: TESTNET_NETWORK_PASSPHRASE,
          address,
        });
        if (signerAddress && signerAddress !== address) {
          throw {
            kind: "account_changed",
            actual: signerAddress,
            expected: address,
          } satisfies WalletError;
        }
        return signedTxXdr;
      } catch (error) {
        throw toWalletError(error);
      }
    },

    async signAuthEntry(entryXdr) {
      try {
        const runtime = await loadKit();
        assertTestnet(await readNetwork(runtime));
        const { signedAuthEntry } = await runtime.kit.signAuthEntry(entryXdr, {
          networkPassphrase: TESTNET_NETWORK_PASSPHRASE,
        });
        return signedAuthEntry;
      } catch (error) {
        throw toWalletError(error);
      }
    },

    async watchChanges(listener): Promise<StopWatchingWallet> {
      const runtime = await loadKit();
      if (runtime.transport === "wallet_connect") {
        // WalletConnect does not expose Freighter's extension change stream.
        // Session state is refreshed when the tab regains focus instead.
        return () => undefined;
      }

      const { WatchWalletChanges } = await import("@stellar/freighter-api");
      const watcher = new WatchWalletChanges();
      const result = watcher.watch((change) => {
        const snapshot: WalletSnapshot = {
          address: change.address || null,
          network: change.networkPassphrase,
        };

        if (change.error) {
          snapshot.error = toWalletError(change.error);
        }

        listener(snapshot);
      });

      if (result.error) {
        throw toWalletError(result.error);
      }

      return () => watcher.stop();
    },
  };
}
