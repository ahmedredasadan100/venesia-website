import { NextResponse } from "next/server";

import { clearAdminSessionCookie } from "../../../../../lib/admin/auth/require-admin-api";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearAdminSessionCookie());
  return response;
}
