import { parseAdminLinkFromFormData } from "./form-fields";
import { serializeAdminLink } from "./serialize";
import type { AdminLinkTarget, AdminLinkValue } from "./types";

export type SavedAdminLinkField = {
  link: AdminLinkValue;
  target: AdminLinkTarget;
};

export function linkFieldFromFormData(formData: FormData, prefix: string): SavedAdminLinkField | undefined {
  const link = serializeAdminLink(parseAdminLinkFromFormData(formData, prefix));
  if (!link) return undefined;
  return {
    link,
    target: link.target ?? "_self",
  };
}

export function hasSavedLinkField(value: SavedAdminLinkField | undefined) {
  return Boolean(value?.link && value.link.link_kind !== "none");
}
