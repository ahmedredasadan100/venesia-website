import { NextResponse } from "next/server";

import { createAdminSessionCookie } from "./require-admin-api";
import { getAdminAuthConfig, verifyAdminCredentials } from "./session";

export async function handleAdminLoginRequest(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const config = getAdminAuthConfig();
  if (!config.configured) {
    return NextResponse.json(
      {
        error:
          "Admin auth is not configured on the server. Set ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET (16+ chars), then redeploy/restart.",
      },
      { status: 503 },
    );
  }

  if (!verifyAdminCredentials(username, password)) {
    return NextResponse.json(
      {
        error:
          "Invalid credentials. On Vercel/VPS, confirm ADMIN_* env values and run a full redeploy/restart after changes.",
      },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(createAdminSessionCookie(username, request));
  return response;
}
