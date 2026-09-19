/**
 * Construction of the generated `showup-bond` client.
 *
 * The contract id and network passphrase come from the generated
 * `networks.testnet` block — never hard-coded here. Testnet is the only network
 * this app talks to.
 */

import { Client, networks } from "showup-bond-client";

import { TESTNET_NETWORK_PASSPHRASE, getRpcUrl } from "../stellar";

/**
 * What `lib/contract` needs from a wallet: an address and a function that turns
 * an unsigned transaction XDR into a signed one. Deliberately structural, so
 * `lib/contract` never imports the Wallets Kit or `lib/wallet`.
 */
export type Signer = {
  address: string;
  signTransaction: (xdr: string) => Promise<string>;
};

const network = networks.testnet;

if (network.networkPassphrase !== TESTNET_NETWORK_PASSPHRASE) {
  throw new Error(
    "showup-bond-client is not bound to Stellar Testnet. Refusing to build a contract client.",
  );
}

/** The deployed contract id, from the generated bindings. */
export const CONTRACT_ID = network.contractId;

/** The network passphrase, from the generated bindings. */
export const NETWORK_PASSPHRASE = network.networkPassphrase;

let cachedReadClient: Client | undefined;
let cachedReadClientUrl: string | undefined;

/** A simulation-only client. Reads need no signer and no source account. */
export function getReadClient(): Client {
  const rpcUrl = getRpcUrl();

  if (!cachedReadClient || cachedReadClientUrl !== rpcUrl) {
    cachedReadClient = new Client({
      contractId: CONTRACT_ID,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl,
      allowHttp: rpcUrl.startsWith("http://"),
    });
    cachedReadClientUrl = rpcUrl;
  }

  return cachedReadClient;
}

/**
 * A client bound to a signer, for writes.
 *
 * Not cached: the connected address can change mid-session, and a stale source
 * account is exactly the sort of bug that is invisible until it costs a
 * signature.
 */
export function getWriteClient(signer: Signer): Client {
  const rpcUrl = getRpcUrl();

  return new Client({
    contractId: CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl,
    allowHttp: rpcUrl.startsWith("http://"),
    publicKey: signer.address,
    signTransaction: async (xdr: string) => ({
      signedTxXdr: await signer.signTransaction(xdr),
      signerAddress: signer.address,
    }),
  });
}
