"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  isWalletError,
  TESTNET_NETWORK_PASSPHRASE,
  type Wallet,
  type WalletError,
  type WalletSnapshot,
} from "./port";
import {
  createWalletsKitAdapter,
  toWalletError,
} from "./wallets-kit-adapter";

export type WalletStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "wrong_network"
  | "error";

type WalletState = {
  address: string | null;
  network: string | null;
  status: WalletStatus;
  error: WalletError | null;
  notice: string | null;
};

export type WalletContextValue = WalletState & {
  canTransact: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  /**
   * Signs through the provider's own wallet instance. Feature code must use
   * this rather than constructing an adapter of its own, so that every
   * signature goes through the same connection and network guard.
   */
  signTransaction: (xdr: string) => Promise<string>;
};

type WalletProviderProps = {
  children: ReactNode;
  wallet?: Wallet;
};

const disconnectedState: WalletState = {
  address: null,
  network: null,
  status: "disconnected",
  error: null,
  notice: null,
};

const WalletContext = createContext<WalletContextValue | null>(null);

function stateFromError(error: WalletError, address: string | null): WalletState {
  if (error.kind === "wrong_network") {
    return {
      address,
      network: error.actual,
      status: "wrong_network",
      error,
      notice: null,
    };
  }

  return {
    address: null,
    network: null,
    status: error.kind === "rejected" ? "disconnected" : "error",
    error,
    notice: null,
  };
}

export function WalletProvider({ children, wallet }: WalletProviderProps) {
  const [activeWallet] = useState<Wallet>(
    () => wallet ?? createWalletsKitAdapter(),
  );
  const walletRef = useRef<Wallet>(activeWallet);
  const stateRef = useRef<WalletState>(disconnectedState);
  const [state, setState] = useState<WalletState>(disconnectedState);

  const commit = useCallback((nextState: WalletState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const resetForAddressChange = useCallback(() => {
    commit({
      ...disconnectedState,
      notice: "Wallet account changed. Reconnect to continue.",
    });
  }, [commit]);

  const applySnapshot = useCallback(
    (snapshot: WalletSnapshot) => {
      const current = stateRef.current;

      if (snapshot.error) {
        if (
          snapshot.error.kind === "no_wallet" ||
          snapshot.error.kind === "not_connected"
        ) {
          commit({ ...disconnectedState, error: snapshot.error });
          return;
        }

        // Anything else — including a wrong-network report from the watcher —
        // must still reach the UI. Dropping it would leave the banner hidden
        // while the wallet is on the wrong network.
        commit(stateFromError(snapshot.error, current.address));
        return;
      }

      if (!snapshot.address) {
        commit(disconnectedState);
        return;
      }

      if (current.address && snapshot.address !== current.address) {
        resetForAddressChange();
        return;
      }

      if (snapshot.network !== TESTNET_NETWORK_PASSPHRASE) {
        const error: WalletError = {
          kind: "wrong_network",
          actual: snapshot.network,
          expected: TESTNET_NETWORK_PASSPHRASE,
        };
        commit(stateFromError(error, snapshot.address));
        return;
      }

      commit({
        address: snapshot.address,
        network: snapshot.network,
        status: "connected",
        error: null,
        notice: null,
      });
    },
    [commit, resetForAddressChange],
  );

  const refresh = useCallback(async () => {
    const current = stateRef.current;
    if (current.status === "disconnected" || current.status === "connecting") {
      return;
    }

    const activeWallet = walletRef.current;

    try {
      const [address, network] = await Promise.all([
        activeWallet.getAddress(),
        activeWallet.getNetwork(),
      ]);
      applySnapshot({ address, network });
    } catch (error) {
      const walletError = isWalletError(error) ? error : toWalletError(error);
      commit(stateFromError(walletError, current.address));
    }
  }, [applySnapshot, commit]);

  const connect = useCallback(async () => {
    if (stateRef.current.status === "connecting") {
      return;
    }

    commit({
      address: null,
      network: null,
      status: "connecting",
      error: null,
      notice: null,
    });

    const activeWallet = walletRef.current;

    try {
      const address = await activeWallet.connect();
      const network = await activeWallet.getNetwork();
      applySnapshot({ address, network });
    } catch (error) {
      const walletError = isWalletError(error) ? error : toWalletError(error);
      let address: string | null = null;

      if (walletError.kind === "wrong_network") {
        address = await activeWallet.getAddress().catch(() => null);
      }

      commit(stateFromError(walletError, address));
    }
  }, [applySnapshot, commit]);

  const disconnect = useCallback(async () => {
    try {
      await walletRef.current.disconnect();
    } finally {
      commit(disconnectedState);
    }
  }, [commit]);

  useEffect(() => {
    const handleFocus = () => {
      void refresh();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refresh]);

  useEffect(() => {
    if (
      !state.address ||
      state.status === "disconnected" ||
      state.status === "connecting" ||
      !walletRef.current?.watchChanges
    ) {
      return;
    }

    let stopped = false;
    let stopWatching: (() => void) | undefined;

    void walletRef.current
      .watchChanges(applySnapshot)
      .then((stop) => {
        if (stopped) {
          stop();
        } else {
          stopWatching = stop;
        }
      })
      .catch((error) => {
        if (!stopped) {
          const walletError = toWalletError(error);
          commit(stateFromError(walletError, stateRef.current.address));
        }
      });

    return () => {
      stopped = true;
      stopWatching?.();
    };
  }, [applySnapshot, commit, state.address, state.status]);

  const signTransaction = useCallback(async (xdr: string) => {
    try {
      return await walletRef.current.signTransaction(xdr);
    } catch (error) {
      const walletError = isWalletError(error) ? error : toWalletError(error);

      // A wrong-network result at signing time must also move the UI into the
      // blocking state, not just fail this one call.
      if (walletError.kind === "wrong_network") {
        commit(stateFromError(walletError, stateRef.current.address));
      }

      throw walletError;
    }
  }, [commit]);

  const value = useMemo<WalletContextValue>(
    () => ({
      ...state,
      canTransact:
        state.status === "connected" &&
        state.network === TESTNET_NETWORK_PASSPHRASE &&
        Boolean(state.address),
      connect,
      disconnect,
      refresh,
      signTransaction,
    }),
    [connect, disconnect, refresh, signTransaction, state],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error("useWallet must be used inside WalletProvider.");
  }

  return context;
}
