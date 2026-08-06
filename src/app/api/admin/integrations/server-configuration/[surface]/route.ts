import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "../../../../../../lib/admin/auth/require-admin-api";
import { requireAdminSession } from "../../../../../../lib/admin/auth/require-admin-session";
import {
  getIntegrationAppConfigurationDefinition,
  getIntegrationAppConfigurationSurface,
  isIntegrationAppConfigurationSurface,
} from "../../../../../../lib/admin/integrations/server-configuration-contract";
import {
  importIntegrationApplicationConfiguration,
  removeIntegrationApplicationConfigurationOwner,
  saveIntegrationApplicationConfiguration,
  testIntegrationApplicationConfigurationSurface,
} from "../../../../../../lib/admin/integrations/server-configuration-service";

export const dynamic = "force-dynamic";

const VersionSchema = z.number().int().min(0).max(2_147_483_647);
const ActionSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("save"),
    expectedVersion: VersionSchema,
    values: z.record(z.string(), z.string().max(4096)).refine((value) => Object.keys(value).length <= 10),
  }).strict(),
  z.object({ operation: z.literal("import_environment"), expectedVersion: VersionSchema }).strict(),
  z.object({ operation: z.literal("test"), expectedVersion: VersionSchema }).strict(),
  z.object({ operation: z.literal("remove"), expectedVersion: VersionSchema }).strict(),
]);

const privateHeaders = {
  "cache-control": "private, no-store, max-age=0",
  vary: "Cookie",
};

function sameOriginMutation(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  if (fetchSite && fetchSite !== "same-origin") return false;
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function safeError(error: unknown) {
  const value = error instanceof Error ? error.message.split(":")[0] : "integration_app_configuration_action_failed";
  return /^[a-z0-9_]{1,120}$/.test(value)
    ? value
    : "integration_app_configuration_action_failed";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ surface: string }> },
) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ ok: false, error: "integration_app_configuration_csrf_rejected" }, {
      status: 403,
      headers: privateHeaders,
    });
  }
  const { surface: rawSurface } = await context.params;
  if (!isIntegrationAppConfigurationSurface(rawSurface)) {
    return NextResponse.json({ ok: false, error: "integration_app_configuration_surface_invalid" }, {
      status: 404,
      headers: privateHeaders,
    });
  }
  const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "integration_app_configuration_action_invalid" }, {
      status: 400,
      headers: privateHeaders,
    });
  }

  const surface = getIntegrationAppConfigurationSurface(rawSurface);
  const action = parsed.data;
  if (rawSurface === "whatsapp" && action.operation !== "test") {
    return NextResponse.json({ ok: false, error: "integration_app_configuration_shared_owner_required" }, {
      status: 409,
      headers: privateHeaders,
    });
  }

  try {
    const user = await requireAdminSession();
    let result: unknown;
    if (action.operation === "save") {
      const allowed = new Set<string>(
        getIntegrationAppConfigurationDefinition(surface.owner).fields.map((field) => field.key),
      );
      if (Object.keys(action.values).some((key) => !allowed.has(key))) {
        return NextResponse.json({ ok: false, error: "integration_app_configuration_key_invalid" }, {
          status: 400,
          headers: privateHeaders,
        });
      }
      result = await saveIntegrationApplicationConfiguration({
        provider: surface.owner,
        expectedVersion: action.expectedVersion,
        values: action.values,
        user,
      });
    } else if (action.operation === "import_environment") {
      result = await importIntegrationApplicationConfiguration(surface.owner, action.expectedVersion, user);
    } else if (action.operation === "remove") {
      result = await removeIntegrationApplicationConfigurationOwner(surface.owner, action.expectedVersion, user);
    } else {
      result = await testIntegrationApplicationConfigurationSurface({
        surface: rawSurface,
        expectedVersion: action.expectedVersion,
        user,
      });
    }
    return NextResponse.json({ ok: true, result }, { headers: privateHeaders });
  } catch (error) {
    const code = safeError(error);
    const status = code.includes("version_conflict") || code.includes("test_conflict")
      ? 409
      : code.includes("rate_limited")
        ? 429
        : 422;
    return NextResponse.json({ ok: false, error: code }, { status, headers: privateHeaders });
  }
}
