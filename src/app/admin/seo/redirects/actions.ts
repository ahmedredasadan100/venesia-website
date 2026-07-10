"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { clearActiveRedirectsCache } from "../../../../lib/redirects/load-active-redirects";
import type { RedirectStatus, RedirectType, UrlRedirectRecord } from "../../../../lib/redirects/redirect-types";
import { validateRedirectInput } from "../../../../lib/redirects/validate-redirect";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

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

export async function createRedirectAction(formData: FormData) {
  const user = await requireAdminSession();

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
    redirectWithMessage("/admin/seo/redirects", "error", validation.error);
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
    .select("id")
    .single<{ id: number }>();

  if (error) {
    redirectWithMessage("/admin/seo/redirects", "error", error.message);
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
  redirectWithMessage("/admin/seo/redirects", "notice", "created");
}

export async function updateRedirectAction(formData: FormData) {
  const user = await requireAdminSession();

  const idRaw = getString(formData, "id");
  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) {
    redirectWithMessage("/admin/seo/redirects", "error", "معرّف التحويل غير صالح.");
  }

  const existing = await getRedirectById(id);
  if (!existing) {
    redirectWithMessage("/admin/seo/redirects", "error", "التحويل غير موجود.");
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
    redirectWithMessage("/admin/seo/redirects", "error", validation.error);
  }

  const note = getString(formData, "note") || null;
  const statusChanged = existing.status !== validation.status;

  const { error } = await getSupabaseAdmin()
    .from("url_redirects")
    .update({
      source_path: validation.sourcePath,
      destination_path: validation.destinationPath,
      redirect_type: validation.redirectType,
      status: validation.status,
      note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    redirectWithMessage("/admin/seo/redirects", "error", error.message);
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
  redirectWithMessage("/admin/seo/redirects", "notice", "updated");
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
