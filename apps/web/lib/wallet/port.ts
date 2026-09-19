export const TESTNET_NETWORK_PASSPHRASE =
  "Test SDF Network ; September 2015";

export type WalletError =
  | { kind: "no_wallet" }
  | { kind: "rejected" }
  | { kind: "wrong_network"; actual: string; expected: string }
  | { kind: "not_connected" }
  | { kind: "unknown"; cause: unknown };

export type WalletSnapshot = {
  address: string | null;
  network: string;
  error?: WalletError;
};

export type StopWatchingWallet = () => void;

export interface Wallet {
  connect(): Promise<string>;
  disconnect(): Promise<void>;
  getAddress(): Promise<string | null>;
  getNetwork(): Promise<string>;
  signTransaction(xdr: string): Promise<string>;
  signAuthEntry?(entryXdr: string): Promise<string>;
  watchChanges?(
    listener: (snapshot: WalletSnapshot) => void,
  ): Promise<StopWatchingWallet>;
}

export function isWalletError(value: unknown): value is WalletError {
  if (!value || typeof value !== "object" || !("kind" in value)) {
    return false;
  }

  return [
    "no_wallet",
    "rejected",
    "wrong_network",
    "not_connected",
    "unknown",
  ].includes(String(value.kind));
}
