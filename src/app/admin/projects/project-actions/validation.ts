"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { validateSlugFormat } from "../../../../lib/admin/slug";
import {
  getProjectPublishValidationError,
  projectPublishInputFromBundle,
  type ProjectPublishInput,
} from "../../../../lib/admin/projects/project-publish-validation";
import type { ProjectRow } from "../../../../lib/projects/types";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { createProjectSlug } from "./helpers";

export async function loadProjectPublishInput(id: number): Promise<ProjectPublishInput | null> {
  const { data: project, error } = await getSupabaseAdmin().from("projects").select("*").eq("id", id).maybeSingle();
  if (error || !project) return null;

  const [{ data: media }, { data: floorPlans }, { data: deliverySpecItems }] = await Promise.all([
    getSupabaseAdmin().from("project_media").select("label, collection").eq("project_id", id),
    getSupabaseAdmin().from("project_floor_plans").select("id").eq("project_id", id),
    getSupabaseAdmin().from("project_delivery_spec_items").select("id").eq("project_id", id),
  ]);

  return projectPublishInputFromBundle({
    project: project as ProjectRow,
    media: media ?? [],
    floorPlans: floorPlans ?? [],
    deliverySpecItems: deliverySpecItems ?? [],
  });
}

export async function validateProjectsCanPublish(ids: number[]) {
  const failures: Array<{ id: number; message: string }> = [];
  const validIds: number[] = [];

  for (const id of ids) {
    const input = await loadProjectPublishInput(id);
    if (!input) {
      failures.push({ id, message: "المشروع غير موجود." });
      continue;
    }
    const error = getProjectPublishValidationError(input);
    if (error) {
      failures.push({ id, message: error });
      continue;
    }
    validIds.push(id);
  }

  return { validIds, failures };
}

export async function checkProjectFieldsAvailable(code: string, slug: string) {
  await requireAdminSession();
  const normalizedCode = code.trim();
  const normalizedSlug = createProjectSlug(slug || code);

  if (!normalizedCode) {
    return { available: false as const, message: "كود المشروع مطلوب." };
  }

  const formatError = validateSlugFormat(normalizedSlug);
  if (formatError) {
    return { available: false as const, message: formatError };
  }

  const supabase = getSupabaseAdmin();
  const { data: codeConflict } = await supabase.from("projects").select("id").eq("code", normalizedCode).maybeSingle();
  if (codeConflict) {
    return { available: false as const, message: "كود المشروع مستخدم بالفعل." };
  }

  const { data: slugConflict } = await supabase.from("projects").select("id").eq("slug", normalizedSlug).maybeSingle();
  if (slugConflict) {
    return { available: false as const, message: "الـ slug مستخدم بالفعل." };
  }

  return { available: true as const };
}
