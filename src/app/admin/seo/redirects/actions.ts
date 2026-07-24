"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import type {
  AdminFormActionState,
  AdminFormMode,
} from "../../../../lib/admin/form-runtime";
import { clearActiveRedirectsCache } from "../../../../lib/redirects/load-active-redirects";
import type { RedirectStatus, RedirectType, UrlRedirectRecord } from "../../../../lib/redirects/redirect-types";
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

function redirectWithMessage(path: string, key: "notice" | "error", value: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
}

function revalidateRedirectsAdmin() {
  revalidatePath("/admin/seo/redirects");
  clearActiveRedirectsCache();
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

export async function toggleRedirectStatusAction(formData: FormData) {
  const user = await requireAdminSession();

  const id = Number(getString(formData, "id"));
  if (!Number.isFinite(id) || id <= 0) {
    redirectWithMessage("/admin/seo/redirects", "error", "معرّف التحويل غير صالح.");
  }

  const existing = await getRedirectById(id);
  if (!existing) {
    redirectWithMessage("/admin/seo/redirects", "error", "التحويل غير موجود.");
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
      redirectWithMessage("/admin/seo/redirects", "error", validation.error);
    }
  }

  const { error } = await getSupabaseAdmin()
    .from("url_redirects")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    redirectWithMessage("/admin/seo/redirects", "error", error.message);
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
  redirectWithMessage("/admin/seo/redirects", "notice", nextStatus === "active" ? "activated" : "deactivated");
}

export async function deleteRedirectAction(formData: FormData) {
  const user = await requireAdminSession();

  const id = Number(getString(formData, "id"));
  if (!Number.isFinite(id) || id <= 0) {
    redirectWithMessage("/admin/seo/redirects", "error", "معرّف التحويل غير صالح.");
  }

  const existing = await getRedirectById(id);
  if (!existing) {
    redirectWithMessage("/admin/seo/redirects", "error", "التحويل غير موجود.");
  }

  const { error } = await getSupabaseAdmin()
    .from("url_redirects")
    .delete()
    .eq("id", id);

  if (error) {
    redirectWithMessage("/admin/seo/redirects", "error", error.message);
  }

  await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction("redirect", "delete"),
      entityType: "redirect",
      entityId: id,
      entityLabel: existing.source_path,
      metadata: {
        destination_path: existing.destination_path,
        redirect_type: existing.redirect_type as RedirectType,
      },
    },
    user,
  );

  revalidateRedirectsAdmin();
  redirectWithMessage("/admin/seo/redirects", "notice", "deleted");
}

export type RedirectListFilters = {
  q?: string;
  status?: string;
  redirectType?: string;
};

export async function listRedirects(filters: RedirectListFilters = {}) {
  let query = getSupabaseAdmin()
    .from("url_redirects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (filters.status === "active" || filters.status === "inactive") {
    query = query.eq("status", filters.status);
  }

  if (filters.redirectType === "301" || filters.redirectType === "302") {
    query = query.eq("redirect_type", filters.redirectType);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  let rows = (data ?? []) as UrlRedirectRecord[];
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (row) =>
        row.source_path.toLowerCase().includes(q) ||
        row.destination_path.toLowerCase().includes(q) ||
        (row.note ?? "").toLowerCase().includes(q),
    );
  }

  return rows;
}
