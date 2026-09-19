"use client";

import { useCallback, useEffect, useState } from "react";

export type AsyncData<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: unknown };

/**
 * Loads client-only data when its key changes, and exposes a `reload` for retry
 * buttons. A stale response is discarded, so a fast key change cannot overwrite
 * newer data with older data.
 *
 * Why this exists rather than an effect in each page: every consumer depends on
 * the connected wallet or an RPC read, neither of which exists during render or
 * on the server. Writing the state inside this cancellable IIFE — after the
 * await, never in the effect body — is also what keeps React's
 * `set-state-in-effect` rule satisfied without a single suppression.
 */
export function useAsyncData<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  options: { enabled?: boolean } = {},
): AsyncData<T> & { reload: () => void } {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<AsyncData<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    void (async () => {
      try {
        const data = await load();
        if (!cancelled) setState({ status: "ready", data });
      } catch (error) {
        if (!cancelled) setState({ status: "error", error });
      }
    })();

    return () => {
      cancelled = true;
    };
    // `load` is intentionally not a dependency: callers pass an inline closure,
    // and the explicit `deps` array is what decides when a reload is warranted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, attempt, ...deps]);

  return { ...state, reload };
}
