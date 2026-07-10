import type { NextRequest } from "next/server";

import { loadActiveRedirectsForRuntime } from "./load-active-redirects";
import type { ActiveRedirectRule } from "./redirect-types";

function buildRedirectDestination(request: NextRequest, destinationPath: string) {
  if (destinationPath.startsWith("http://") || destinationPath.startsWith("https://")) {
    const url = new URL(destinationPath);
    if (!url.search && request.nextUrl.search) {
      url.search = request.nextUrl.search;
    }
    return url;
  }

  const pathWithQuery = `${destinationPath}${request.nextUrl.search}`;
  return new URL(pathWithQuery, request.url);
}

export async function resolvePublicRedirect(
  request: NextRequest,
): Promise<{ destination: URL; status: 301 | 302 } | null> {
  const { pathname } = request.nextUrl;
  const rules = await loadActiveRedirectsForRuntime();
  const match = findMatchingRedirect(pathname, rules);
  if (!match) return null;

  return {
    destination: buildRedirectDestination(request, match.destinationPath),
    status: match.redirectType === "301" ? 301 : 302,
  };
}

function findMatchingRedirect(pathname: string, rules: ActiveRedirectRule[]) {
  for (const rule of rules) {
    if (rule.sourcePath === pathname) {
      return rule;
    }
  }
  return null;
}
