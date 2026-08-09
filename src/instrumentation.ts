import type { Instrumentation } from "next";

import { logError } from "./lib/logging";

function errorDigest(error: unknown) {
  if (!error || typeof error !== "object" || !("digest" in error)) return undefined;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" ? digest : undefined;
}

function requestPathname(path: string) {
  try {
    return new URL(path, "https://internal.invalid").pathname;
  } catch {
    return "[unavailable]";
  }
}

/** Adapts Next.js server request failures into the existing logging owner. */
export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  logError("Unhandled server request failed", error, {
    boundary: "next-request",
    digest: errorDigest(error),
    method: request.method,
    pathname: requestPathname(request.path),
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
  });
};
