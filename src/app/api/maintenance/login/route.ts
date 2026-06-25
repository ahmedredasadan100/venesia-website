import { NextResponse } from "next/server";

import { handleAdminLoginRequest } from "../../../../lib/admin/auth/handle-admin-login";

export async function POST(request: Request) {
  try {
    return await handleAdminLoginRequest(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed.";
    const status = message.includes("not configured") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
