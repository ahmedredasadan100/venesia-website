import "server-only";

export class ProviderRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requiresReauth: boolean;

  constructor(input: { code: string; status: number; message: string; requiresReauth?: boolean }) {
    super(input.message);
    this.name = "ProviderRequestError";
    this.code = input.code;
    this.status = input.status;
    this.requiresReauth = input.requiresReauth === true;
  }
}

function safeProviderMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  const nested = record.error && typeof record.error === "object"
    ? record.error as Record<string, unknown>
    : null;
  const message = nested?.message ?? record.message ?? record.error_description;
  if (typeof message !== "string" || !message) return fallback;
  return message
    .replace(/(?:access|refresh|id)_token["'=:\s]+[^\s"'&,}]+/giu, "credential=[redacted]")
    .replace(/bearer\s+[^\s"'&,}]+/giu, "Bearer [redacted]")
    .replace(/client_secret["'=:\s]+[^\s"'&,}]+/giu, "client_secret=[redacted]")
    .slice(0, 400);
}

export async function providerJson<T>(
  url: string,
  init: RequestInit,
  code: string,
  timeoutMs = 30_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    const payload = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      throw new ProviderRequestError({
        code,
        status: response.status,
        message: safeProviderMessage(payload, `${code}:${response.status}`),
        requiresReauth: response.status === 401 || response.status === 403,
      });
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ProviderRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderRequestError({ code: `${code}_timeout`, status: 504, message: "Provider request timed out." });
    }
    throw new ProviderRequestError({ code, status: 502, message: "Provider request failed." });
  } finally {
    clearTimeout(timeout);
  }
}

export function formBody(values: Record<string, string>) {
  return new URLSearchParams(values).toString();
}

export function isoAfterSeconds(seconds: unknown) {
  const value = Number(seconds);
  return Number.isFinite(value) && value > 0
    ? new Date(Date.now() + value * 1000).toISOString()
    : null;
}

export function selectedAsset(
  assets: readonly { type: string; selected?: boolean; externalId: string }[],
  type: string,
) {
  return assets.find((asset) => asset.type === type && asset.selected !== false);
}
