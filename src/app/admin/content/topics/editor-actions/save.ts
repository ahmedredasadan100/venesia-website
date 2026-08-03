"use server";

import type { AdminFormActionState } from "../../../../../lib/admin/form-runtime";
import { isContentType } from "../../../../../lib/admin/content/content-types";
import { isMediaEditableContentType } from "../../../../../components/admin/content/editors/media/media-content-config";
import { saveArticleContentAdapter } from "../article-actions/save";
import { saveMediaContentAdapter } from "../media-actions/save";

export async function saveContentForm(
  previousState: AdminFormActionState,
  formData: FormData,
): Promise<AdminFormActionState> {
  const contentType = formData.get("content_type");

  if (contentType === "article") {
    return saveArticleContentAdapter(previousState, formData);
  }
  if (isContentType(contentType) && isMediaEditableContentType(contentType)) {
    return saveMediaContentAdapter(previousState, formData);
  }

  return {
    status: "error",
    mode: previousState.mode,
    revision: previousState.revision + 1,
    title: "تعذر حفظ المحتوى",
    message: "نوع المحتوى غير صالح أو غير مدعوم.",
    fieldErrors: {
      content_type: ["اختر نوع محتوى صالحًا."],
    },
    focusTarget: "content_type",
  };
}
