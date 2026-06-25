import { NextResponse } from "next/server";

import { clearAdminSessionCookie } from "../../../../../lib/admin/auth/require-admin-api";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearAdminSessionCookie(request));
  return response;
}
