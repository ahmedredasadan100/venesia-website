"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getString } from "./helpers";
import { updateTopicWithStatus } from "./update";

export async function publishTopic(formData: FormData) {
  await requireAdminSession();
  if (getString(formData, "title")) {
    await updateTopicWithStatus(formData, "published", "published", { validationMode: "publish" });
  }
}

export async function unpublishTopic(formData: FormData) {
  await requireAdminSession();
  if (getString(formData, "title")) {
    await updateTopicWithStatus(formData, "unpublished", "unpublished", { validationMode: "save" });
  }
}
