import { NextResponse } from "next/server";

import {
  getAdminAuthConfig,
  verifyAdminCredentials,
} from "../../../../../lib/admin/auth/session";
import { createAdminSessionCookie } from "../../../../../lib/admin/auth/require-admin-api";

export async function POST(request: Request) {
  try {
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
            "Admin auth is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET (16+ chars) in .env.local, then restart the server.",
        },
        { status: 503 },
      );
    }

    if (!verifyAdminCredentials(username, password)) {
      return NextResponse.json(
        {
          error:
            "Invalid credentials. If you recently changed .env.local, restart the dev/production server so new env values load.",
        },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(createAdminSessionCookie(username));

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed.";
    const status = message.includes("not configured") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
