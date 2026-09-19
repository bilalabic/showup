/**
 * What survives a page reload — and what deliberately does not.
 *
 * The in-flight deposit id, quote id and claimable balance id are kept in
 * `sessionStorage` so a reload resumes polling instead of orphaning a real
 * deposit that is already moving money. The SEP-10 token is NOT here and must
 * never be added: a transaction id is a public reference, a bearer token is
 * not. That asymmetry is the entire point of this file.
 */

const STORAGE_KEY = "showup.anchor.deposit";

/** The only fields allowed to persist. */
export type PersistedDeposit = {
  depositId: string;
  account?: string;
  quoteId?: string;
  claimableBalanceId?: string;
};

function storage(): Storage | undefined {
  try {
    if (typeof sessionStorage === "undefined") return undefined;
    return sessionStorage;
  } catch {
    // Storage can throw outright under a strict cookie policy.
    return undefined;
  }
}

/** Persist the in-flight deposit. Silently a no-op without `sessionStorage`. */
export function saveDeposit(record: PersistedDeposit): void {
  const store = storage();
  if (!store) return;

  try {
    store.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // A full or blocked quota must not break a deposit that is already open.
  }
}

/** Read the in-flight deposit, or `undefined` if there is none. */
export function loadDeposit(): PersistedDeposit | undefined {
  const store = storage();
  if (!store) return undefined;

  let raw: string | null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }
  if (!raw) return undefined;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return undefined;

    const record = parsed as Record<string, unknown>;
    if (typeof record.depositId !== "string" || record.depositId.length === 0) {
      return undefined;
    }

    return {
      depositId: record.depositId,
      account: typeof record.account === "string" ? record.account : undefined,
      quoteId: typeof record.quoteId === "string" ? record.quoteId : undefined,
      claimableBalanceId:
        typeof record.claimableBalanceId === "string"
          ? record.claimableBalanceId
          : undefined,
    };
  } catch {
    return undefined;
  }
}

/** Merge fields into the stored record, creating it if needed. */
export function updateDeposit(patch: Partial<PersistedDeposit>): void {
  const existing = loadDeposit();
  const depositId = patch.depositId ?? existing?.depositId;
  if (!depositId) return;

  saveDeposit({ ...existing, ...patch, depositId });
}

/** Forget the in-flight deposit, once it is settled or abandoned. */
export function clearDeposit(): void {
  const store = storage();
  if (!store) return;

  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do.
  }
}
