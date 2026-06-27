import { headers } from "next/headers";

import { resolveRequestAuditContext } from "./resolve-request-audit-context";

export async function resolveServerActionAuditContext() {
  const headerStore = await headers();
  return resolveRequestAuditContext({ headers: headerStore });
}
