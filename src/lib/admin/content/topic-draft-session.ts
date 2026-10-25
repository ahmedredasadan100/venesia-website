import "server-only";

import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthConfig,
  verifyAdminSessionToken,
} from "../auth/session";
import type { TopicDraftSession } from "./topic-revision";

/** Consume an already-authorized actor; this adapter does not change or grant authentication. */
export async function resolveTopicDraftSession(actor: {
  id: number;
  session_version: number;
}): Promise<TopicDraftSession> {
  const config = getAdminAuthConfig();
  if (!config.configured) throw new Error("Unauthorized");
  const cookieStore = await cookies();
  const payload = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value, config.secret);
  if (!payload || payload.id !== actor.id || payload.sv !== actor.session_version) throw new Error("Unauthorized");
  return {
    actorId: actor.id,
    sessionVersion: actor.session_version,
    expiresAt: payload.exp * 1000,
  };
}
