/**
 * The one place `fetch` is called against the Anchor.
 *
 * Verified live on 2026-09-19: the Anchor sends `access-control-allow-origin: *`
 * on every endpoint probed, and its CORS preflight allows `Authorization` from
 * any origin. So these calls are made DIRECTLY from the browser and there are no
 * Next.js route handlers under `app/api/anchor/`. See `README` in this
 * directory's `index.ts` header for the recorded evidence.
 */

import { ANCHOR_REQUEST_TIMEOUT_MS } from "./config";
import { AnchorError } from "./errors";

export type AnchorRequestInit = {
  method?: "GET" | "POST";
  /** SEP-10 token. Sent as `Authorization: Bearer`. NEVER logged. */
  token?: string;
  /** JSON request body. */
  body?: unknown;
  /** Query parameters. `undefined` values are dropped, not sent as "undefined". */
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /**
   * Set false for an endpoint whose response body is undocumented.
   *
   * Errors are still mapped normally; only the SUCCESS body is left unread.
   * Without this, a fire-and-then-poll call would fail on a plain-text "ok"
   * from an endpoint whose body nobody ever promised would be JSON.
   */
  expectJson?: boolean;
};

/** Build a URL with only the query parameters that actually have values. */
export function buildUrl(
  base: string,
  path: string,
  query: Record<string, string | number | undefined> = {},
): string {
  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedPath =
    path.length === 0 ? "" : path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${trimmedBase}${trimmedPath}`);

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

/** Strip the query string so an endpoint can be reported without leaking ids. */
function endpointLabel(url: string): string {
  const queryStart = url.indexOf("?");
  return queryStart === -1 ? url : url.slice(0, queryStart);
}

type ParsedErrorBody = {
  serverMessage?: string;
  serverType?: string;
};

/** Pull the Anchor's own words out of an error body, whatever shape it took. */
function readErrorBody(raw: string): ParsedErrorBody {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const message =
        typeof record.error === "string"
          ? record.error
          : typeof record.message === "string"
            ? record.message
            : undefined;
      const type = typeof record.type === "string" ? record.type : undefined;
      return { serverMessage: message, serverType: type };
    }
  } catch {
    // Not JSON. The raw body is still the Anchor's own words.
  }

  return { serverMessage: trimmed.slice(0, 500) };
}

/**
 * Perform one Anchor request and return parsed JSON.
 *
 * Failure mapping, all three verified against live probes:
 *  - `fetch` threw          -> `unreachable` ("funding is temporarily unavailable")
 *  - HTTP 403 + `{"type":"authentication_required"}` -> `authentication_required`
 *  - any other non-2xx      -> `server_rejected`, carrying the Anchor's message verbatim
 *
 * 401 is deliberately NOT special-cased for auth: this Anchor answers 403, and
 * `SKILL.md`'s claim of 401 is wrong. A 401 would still be reported honestly as
 * `authentication_required` if the body says so.
 */
export async function anchorRequest<T>(
  url: string,
  init: AnchorRequestInit = {},
): Promise<T> {
  const {
    method = "GET",
    token,
    body,
    signal,
    timeoutMs,
    expectJson = true,
  } = init;
  const label = endpointLabel(url);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs ?? ANCHOR_REQUEST_TIMEOUT_MS,
  );
  const onAbort = () => controller.abort();
  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", onAbort);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    throw new AnchorError(
      "unreachable",
      "Funding is temporarily unavailable — the Anchor could not be reached.",
      { endpoint: label, cause },
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }

  const text = await response.text();

  if (!response.ok) {
    const { serverMessage, serverType } = readErrorBody(text);

    if (serverType === "authentication_required") {
      throw new AnchorError(
        "authentication_required",
        "The Anchor session has expired.",
        {
          status: response.status,
          serverMessage,
          serverType,
          endpoint: label,
        },
      );
    }

    throw new AnchorError("server_rejected", "The Anchor rejected this request.", {
      status: response.status,
      serverMessage,
      serverType,
      endpoint: label,
    });
  }

  if (!expectJson || text.trim().length === 0) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (cause) {
    throw new AnchorError(
      "protocol",
      "The Anchor returned a response this client could not read.",
      { status: response.status, endpoint: label, cause },
    );
  }
}

/** Read a string field, tolerating the numbers some SEP servers emit. */
export function optionalString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.length > 0 ? value : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

/** Read a required string field, or fail with a `protocol` error. */
export function requireString(
  source: Record<string, unknown>,
  key: string,
  context: string,
): string {
  const value = optionalString(source[key]);
  if (value === undefined) {
    throw new AnchorError(
      "protocol",
      `The Anchor's ${context} response is missing "${key}".`,
    );
  }
  return value;
}

/** Narrow an unknown JSON payload to a record, or fail with `protocol`. */
export function requireRecord(
  value: unknown,
  context: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AnchorError(
      "protocol",
      `The Anchor's ${context} response was not an object.`,
    );
  }
  return value as Record<string, unknown>;
}
