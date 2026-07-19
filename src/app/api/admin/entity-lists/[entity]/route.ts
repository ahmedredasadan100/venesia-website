import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAdminApi } from "../../../../../lib/admin/auth/require-admin-api";
import { AdminEntityListQueryValidationError } from "../../../../../lib/admin/entity-list/data-engine/contracts";
import {
  executeAdminEntityListAdapter,
  isAdminEntityListEntityKey,
} from "../../../../../lib/admin/entity-list/data-engine/registry";
import {
  measureAdminEntityListOperation,
  toServerTimingHeader,
} from "../../../../../lib/admin/entity-list/data-engine/instrumentation";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

function errorResponse(
  status: number,
  code: string,
  message: string,
) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: PRIVATE_HEADERS },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ entity: string }> },
) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const { entity } = await context.params;
  if (!isAdminEntityListEntityKey(entity)) {
    return errorResponse(404, "unknown_entity", "Unknown entity list.");
  }

  try {
    const url = new URL(request.url);
    const measured = await measureAdminEntityListOperation(entity, () =>
      executeAdminEntityListAdapter(entity, url.searchParams),
    );
    return NextResponse.json(measured.value.result, {
      headers: {
        ...PRIVATE_HEADERS,
        "Server-Timing": toServerTimingHeader([measured.timing]),
        "X-Admin-Entity-List": entity,
      },
    });
  } catch (error) {
    if (
      error instanceof AdminEntityListQueryValidationError ||
      error instanceof ZodError
    ) {
      return errorResponse(400, "invalid_query", "Invalid list query.");
    }
    console.error(`[admin-entity-list:${entity}]`, error);
    return errorResponse(
      500,
      "list_load_failed",
      "Unable to load the requested list.",
    );
  }
}
