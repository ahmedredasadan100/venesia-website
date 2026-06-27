const MAX_USER_AGENT_LENGTH = 512;

export function resolveRequestAuditContext(request?: Pick<Request, "headers">) {
  if (!request) {
    return { ipAddress: null as string | null, userAgent: null as string | null };
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ipAddress = (forwarded?.split(",")[0]?.trim() || realIp || null) ?? null;

  const rawUserAgent = request.headers.get("user-agent") ?? "";
  const userAgent = rawUserAgent ? rawUserAgent.slice(0, MAX_USER_AGENT_LENGTH) : null;

  return { ipAddress, userAgent };
}
