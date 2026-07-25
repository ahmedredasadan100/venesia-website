import {
  CMS_MAX_IMAGE_BYTES,
  CMS_MAX_PDF_BYTES,
} from "../../../../lib/admin/media-intelligence/cms-upload-policy";
import type { AdminFormActionState } from "../../../../lib/admin/form-runtime";

export const MEDIA_SETTINGS_LIMITS = {
  minimumMegabytes: 1,
  maximumImageMegabytes: CMS_MAX_IMAGE_BYTES / 1024 / 1024,
  maximumDocumentMegabytes: CMS_MAX_PDF_BYTES / 1024 / 1024,
} as const;

export type MediaSettingsField =
  | "maxImageMb"
  | "maxDocumentMb"
  | "allowedKinds"
  | "allowedImageExtensions"
  | "allowedDocumentExtensions";

export type MediaSettingsActionState = AdminFormActionState;

export const MEDIA_SETTINGS_ACTION_INITIAL: MediaSettingsActionState = {
  status: "idle",
  mode: "edit",
  revision: 0,
  message: "",
};
