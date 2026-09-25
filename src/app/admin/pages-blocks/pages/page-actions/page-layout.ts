"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import type { Json } from "../../../../../lib/database.types";
import { mutatePageComposition, pageExists } from "./helpers";

export type PageLayoutRegionInput = {
  key: string;
  adminLabel: string;
  sortOrder: number;
};

export type PageLayoutActionResult = {
  ok: boolean;
  message: string;
  layoutId?: number;
  warning?: string | null;
};

function failureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "تعذر حفظ التخطيط.";
  if (message.includes("page_layout_has_invalid_assignments")) {
    return "تعذر اختيار التخطيط لأن بعض موديولات الصفحة مرتبطة بمناطق غير موجودة فيه.";
  }
  if (message.includes("page_region_in_use")) {
    return "لا يمكن حذف منطقة مستخدمة حاليًا في صفحات مرتبطة بهذا التخطيط.";
  }
  if (message.includes("page_layout_legacy_protected")) {
    return "التخطيط الحالي محمي للحفاظ على شكل الصفحات المنشورة. أنشئ تخطيطًا جديدًا بدل تعديله.";
  }
  if (message.includes("page_layout_key_immutable")) {
    return "المعرّف التقني للتخطيط ثابت بعد الإنشاء؛ يمكنك تعديل الاسم الإداري والمناطق فقط.";
  }
  if (message.includes("page_layout_payload_invalid")) {
    return "راجع اسم التخطيط والمناطق وترتيبها؛ يجب أن تكون المعرّفات فريدة وصالحة.";
  }
  if (message.includes("duplicate key") || message.includes("23505")) {
    return "يوجد تخطيط أو ترتيب منطقة بالقيمة نفسها بالفعل.";
  }
  return message;
}

async function revalidateLayoutChange(pageId: number) {
  try {
    await revalidatePageBlocksPath(pageId);
    return null;
  } catch {
    return "تم الحفظ، لكن تعذر تحديث الكاش بالكامل. حدّث الصفحة للتحقق من أحدث نسخة.";
  }
}

export async function savePageLayout(input: {
  pageId: number;
  layoutId: number | null;
  key: string;
  adminLabel: string;
  regions: readonly PageLayoutRegionInput[];
  assignPage: boolean;
}): Promise<PageLayoutActionResult> {
  const actor = await requireAdminSession();
  if (!Number.isSafeInteger(input.pageId) || input.pageId <= 0 || !(await pageExists(input.pageId))) {
    return { ok: false, message: "الصفحة غير موجودة." };
  }
  const payload = {
    layout_id: input.layoutId,
    key: input.key.trim(),
    admin_label: input.adminLabel.trim(),
    regions: input.regions.map((region) => ({
      key: region.key.trim(),
      admin_label: region.adminLabel.trim(),
      sort_order: region.sortOrder,
    })),
    assign_page: input.assignPage,
  } satisfies Json;
  try {
    const result = await mutatePageComposition(input.pageId, "save_layout", payload, actor);
    const layoutId = Number(result.layout_id);
    if (!Number.isSafeInteger(layoutId) || layoutId <= 0) {
      return { ok: false, message: "رفض النظام نتيجة حفظ تخطيط غير مكتملة." };
    }
    const warning = await revalidateLayoutChange(input.pageId);
    return {
      ok: true,
      layoutId,
      warning,
      message: input.assignPage
        ? "تم حفظ التخطيط ومناطقه واختياره للصفحة ذريًا."
        : "تم حفظ التخطيط ومناطقه ذريًا.",
    };
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
}

export async function selectPageLayout(
  pageId: number,
  layoutId: number,
): Promise<PageLayoutActionResult> {
  const actor = await requireAdminSession();
  if (!Number.isSafeInteger(pageId) || pageId <= 0 || !(await pageExists(pageId))) {
    return { ok: false, message: "الصفحة غير موجودة." };
  }
  try {
    await mutatePageComposition(pageId, "select_layout", { layout_id: layoutId }, actor);
    const warning = await revalidateLayoutChange(pageId);
    return { ok: true, layoutId, warning, message: "تم اختيار التخطيط للصفحة." };
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
}
