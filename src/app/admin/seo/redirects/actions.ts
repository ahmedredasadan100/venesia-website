"use server";

import { revalidatePath } from "next/cache";

import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import type {
  AdminFormActionState,
  AdminFormMode,
} from "../../../../lib/admin/form-runtime";
import { saveAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";
import {
  getRedirectsDefaultColumnKeys,
  getRedirectsPreferenceColumnKeys,
  REDIRECTS_LIST_VIEW_KEY,
  type RedirectColumnKey,
} from "../../../../lib/admin/redirects/list-config";
import type { RedirectStatus, UrlRedirectRecord } from "../../../../lib/redirects/redirect-types";
import {
  validateRedirectInput,
  type RedirectValidationResult,
} from "../../../../lib/redirects/validate-redirect";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export type RedirectFormActionState = AdminFormActionState<UrlRedirectRecord>;

type DatabaseErrorLike = {
  code?: string;
  message?: string;
};

type RedirectMutationFailure = {
  ok: false;
  code: string;
  message: string;
};

export type RedirectStatusMutationResult =
  | RedirectMutationFailure
  | {
      ok: true;
      feedbackStatus: "success";
      message: string;
      status: RedirectStatus;
      updatedAt: string;
    };

export type RedirectDeleteMutationResult =
  | RedirectMutationFailure
  | {
      ok: true;
      feedbackStatus: "success";
      message: string;
    };

const REDIRECT_FORM_FIELD_BY_DOMAIN_FIELD = {
  sourcePath: "source_path",
  destinationPath: "destination_path",
  redirectType: "redirect_type",
  status: "status",
} as const;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function revalidateRedirectsAdmin() {
  revalidatePath("/admin/seo/redirects");
}

function buildRedirectFormFailure(
  mode: AdminFormMode,
  revision: number,
  message: string,
  field?: string,
): RedirectFormActionState {
  return {
    status: "error",
    mode,
    revision,
    title: "تعذر حفظ التحويل",
    message,
    ...(field
      ? { fieldErrors: { [field]: [message] }, focusTarget: field }
      : {}),
  };
}

function buildRedirectValidationFailure(
  mode: AdminFormMode,
  revision: number,
  validation: Extract<RedirectValidationResult, { ok: false }>,
) {
  return buildRedirectFormFailure(
    mode,
    revision,
    validation.error,
    REDIRECT_FORM_FIELD_BY_DOMAIN_FIELD[validation.field],
  );
}

function buildRedirectDatabaseFailure(
  mode: AdminFormMode,
  revision: number,
  error: unknown,
  fallback: string,
) {
  const databaseError =
    error && typeof error === "object" ? (error as DatabaseErrorLike) : {};
  if (databaseError.code === "23505") {
    return buildRedirectFormFailure(
      mode,
      revision,
      "مسار المصدر مستخدم بالفعل.",
      "source_path",
    );
  }
  return buildRedirectFormFailure(
    mode,
    revision,
    databaseError.message || fallback,
  );
}

function buildRedirectFormSuccess(
  mode: AdminFormMode,
  revision: number,
  code: "created" | "updated",
  result: UrlRedirectRecord,
): RedirectFormActionState {
  return {
    status: "success",
    mode,
    revision,
    title: "تم الحفظ بنجاح",
    message:
      code === "created"
        ? "تم إنشاء التحويل بنجاح."
        : "تم تحديث التحويل بنجاح.",
    code,
    entityId: result.id,
    savedRevision: `${result.id}:${result.updated_at}`,
    result,
  };
}

async function listRedirectsForValidation() {
  const { data, error } = await getSupabaseAdmin()
    .from("url_redirects")
    .select("id, source_path, destination_path, status");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<Pick<UrlRedirectRecord, "id" | "source_path" | "destination_path" | "status">>;
}

async function getRedirectById(id: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("url_redirects")
    .select("*")
    .eq("id", id)
    .maybeSingle<UrlRedirectRecord>();

  if (error) throw new Error(error.message);
  return data;
}

export async function createRedirectAction(
  previousState: RedirectFormActionState,
  formData: FormData,
): Promise<RedirectFormActionState> {
  const mode: AdminFormMode = "create";
  const revision = previousState.revision + 1;
  const user = await requireAdminSession();
  try {
    const validation = validateRedirectInput(
      {
        sourcePath: getString(formData, "source_path"),
        destinationPath: getString(formData, "destination_path"),
        redirectType: getString(formData, "redirect_type"),
        status: getString(formData, "status") || "active",
      },
      await listRedirectsForValidation(),
    );

    if (!validation.ok) {
      return buildRedirectValidationFailure(mode, revision, validation);
    }

    const note = getString(formData, "note") || null;
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseAdmin()
      .from("url_redirects")
      .insert({
        source_path: validation.sourcePath,
        destination_path: validation.destinationPath,
        redirect_type: validation.redirectType,
        status: validation.status,
        note,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single<UrlRedirectRecord>();

    if (error || !data) {
      return buildRedirectDatabaseFailure(
        mode,
        revision,
        error,
        "تعذر إنشاء التحويل. حاول مرة أخرى.",
      );
    }

    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction("redirect", "create"),
        entityType: "redirect",
        entityId: data.id,
        entityLabel: validation.sourcePath,
        metadata: {
          destination_path: validation.destinationPath,
          redirect_type: validation.redirectType,
          status: validation.status,
        },
      },
      user,
    );

    revalidateRedirectsAdmin();
    return buildRedirectFormSuccess(mode, revision, "created", data);
  } catch (error) {
    return buildRedirectDatabaseFailure(
      mode,
      revision,
      error,
      "تعذر إنشاء التحويل. حاول مرة أخرى.",
    );
  }
}

export async function updateRedirectAction(
  previousState: RedirectFormActionState,
  formData: FormData,
): Promise<RedirectFormActionState> {
  const mode: AdminFormMode = "edit";
  const revision = previousState.revision + 1;
  const user = await requireAdminSession();

  const idRaw = getString(formData, "id");
  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) {
    return buildRedirectFormFailure(
      mode,
      revision,
      "معرّف التحويل غير صالح.",
    );
  }

  try {
    const existing = await getRedirectById(id);
    if (!existing) {
      return buildRedirectFormFailure(
        mode,
        revision,
        "التحويل غير موجود.",
      );
    }

    const validation = validateRedirectInput(
      {
        sourcePath: getString(formData, "source_path"),
        destinationPath: getString(formData, "destination_path"),
        redirectType: getString(formData, "redirect_type"),
        status: getString(formData, "status") || "active",
        excludeId: id,
      },
      await listRedirectsForValidation(),
    );

    if (!validation.ok) {
      return buildRedirectValidationFailure(mode, revision, validation);
    }

    const note = getString(formData, "note") || null;
    const statusChanged = existing.status !== validation.status;
    const { data, error } = await getSupabaseAdmin()
      .from("url_redirects")
      .update({
        source_path: validation.sourcePath,
        destination_path: validation.destinationPath,
        redirect_type: validation.redirectType,
        status: validation.status,
        note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle<UrlRedirectRecord>();

    if (error || !data) {
      return buildRedirectDatabaseFailure(
        mode,
        revision,
        error,
        "تعذر تحديث التحويل. حاول مرة أخرى.",
      );
    }

    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction("redirect", "update"),
        entityType: "redirect",
        entityId: id,
        entityLabel: validation.sourcePath,
        metadata: {
          destination_path: validation.destinationPath,
          redirect_type: validation.redirectType,
          status: validation.status,
        },
      },
      user,
    );

    if (statusChanged) {
      await recordCmsAdminAudit(
        {
          action: buildCmsAuditAction(
            "redirect",
            validation.status === "active" ? "publish" : "unpublish",
          ),
          entityType: "redirect",
          entityId: id,
          entityLabel: validation.sourcePath,
          metadata: { status: validation.status },
        },
        user,
      );
    }

    revalidateRedirectsAdmin();
    return buildRedirectFormSuccess(mode, revision, "updated", data);
  } catch (error) {
    return buildRedirectDatabaseFailure(
      mode,
      revision,
      error,
      "تعذر تحديث التحويل. حاول مرة أخرى.",
    );
  }
}

export async function toggleRedirectStatusAction(
  id: number,
): Promise<RedirectStatusMutationResult> {
  const user = await requireAdminSession();

  if (!Number.isInteger(id) || id <= 0) {
    return {
      ok: false,
      code: "invalid_redirect_id",
      message: "معرّف التحويل غير صالح.",
    };
  }

  const existing = await getRedirectById(id);
  if (!existing) {
    return {
      ok: false,
      code: "redirect_not_found",
      message: "التحويل غير موجود.",
    };
  }

  const nextStatus: RedirectStatus = existing.status === "active" ? "inactive" : "active";

  if (nextStatus === "active") {
    const validation = validateRedirectInput(
      {
        sourcePath: existing.source_path,
        destinationPath: existing.destination_path,
        redirectType: existing.redirect_type,
        status: "active",
        excludeId: id,
      },
      await listRedirectsForValidation(),
    );

    if (!validation.ok) {
      return {
        ok: false,
        code: "redirect_activation_invalid",
        message: validation.error,
      };
    }
  }

  const { data, error } = await getSupabaseAdmin()
    .from("url_redirects")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("status, updated_at")
    .maybeSingle<Pick<UrlRedirectRecord, "status" | "updated_at">>();

  if (error || !data) {
    return {
      ok: false,
      code: error ? "redirect_status_update_failed" : "redirect_not_found",
      message: error?.message ?? "التحويل غير موجود.",
    };
  }

  await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction("redirect", nextStatus === "active" ? "publish" : "unpublish"),
      entityType: "redirect",
      entityId: id,
      entityLabel: existing.source_path,
      metadata: { status: nextStatus },
    },
    user,
  );

  revalidateRedirectsAdmin();
  return {
    ok: true,
    feedbackStatus: "success",
    message:
      data.status === "active"
        ? "تم تفعيل التحويل بنجاح."
        : "تم إيقاف التحويل بنجاح.",
    status: data.status,
    updatedAt: data.updated_at,
  };
}

export async function deleteRedirectAction(
  id: number,
): Promise<RedirectDeleteMutationResult> {
  const user = await requireAdminSession();

  if (!Number.isInteger(id) || id <= 0) {
    return {
      ok: false,
      code: "invalid_redirect_id",
      message: "معرّف التحويل غير صالح.",
    };
  }

  const existing = await getRedirectById(id);
  if (!existing) {
    return {
      ok: false,
      code: "redirect_not_found",
      message: "التحويل غير موجود.",
    };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("url_redirects")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle<{ id: number }>();

  if (error || !data) {
    return {
      ok: false,
      code: error ? "redirect_delete_failed" : "redirect_not_found",
      message: error?.message ?? "التحويل غير موجود.",
    };
  }

  await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction("redirect", "delete"),
      entityType: "redirect",
      entityId: id,
      entityLabel: existing.source_path,
      metadata: {
        destination_path: existing.destination_path,
        redirect_type: existing.redirect_type,
      },
    },
    user,
  );

  revalidateRedirectsAdmin();
  return {
    ok: true,
    feedbackStatus: "success",
    message: "تم حذف التحويل بنجاح.",
  };
}

export async function saveRedirectsTablePreferences(visibleColumns: string[]) {
  return saveAdminColumnPreferences({
    viewKey: REDIRECTS_LIST_VIEW_KEY,
    visibleColumns,
    allowedColumns: getRedirectsPreferenceColumnKeys(),
  });
}

export async function restoreRedirectsTablePreferences() {
  return saveRedirectsTablePreferences([
    ...getRedirectsDefaultColumnKeys(),
  ] as RedirectColumnKey[]);
}
