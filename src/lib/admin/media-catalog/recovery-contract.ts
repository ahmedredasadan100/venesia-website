export const MEDIA_RECOVERY_ACTIONS = [
  "retry_verification",
  "retry_finalization",
  "cancel_reservation",
  "confirm_missing",
  "preview_scoped_reconciliation",
  "resolve_write_lease",
] as const;

export type MediaRecoveryAction = (typeof MEDIA_RECOVERY_ACTIONS)[number];
export type MediaRecoveryTargetKind = "delete_reservation" | "asset" | "write_lease";

export type MediaRecoveryItem = {
  id: string;
  kind: MediaRecoveryTargetKind;
  state: string;
  assetId: string | null;
  assetCount: number;
  assetLabel: string;
  publicValue: string | null;
  failureCode: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  lastStorageVerification: string | null;
  lastProviderScan: string | null;
  suggestedAction: string;
  allowedActions: MediaRecoveryAction[];
  blockedReasons: string[];
};

export type MediaRecoveryQueue = {
  available: boolean;
  generatedAt: string;
  warning: string | null;
  truncated: boolean;
  resultLimitPerType: number;
  context: {
    provider: string | null;
    imageBucket: string | null;
    environment: string | null;
    environmentIdentity: string | null;
    registryVersion: string | null;
    runtimeState: "synced" | "uncertain";
    lastSuccessfulRunIdentity: string | null;
    lastSuccessfulRunAt: string | null;
  };
  counts: {
    stuckDeletes: number;
    missingOrUncertainAssets: number;
    unresolvedLeaseBatches: number;
  };
  items: MediaRecoveryItem[];
};

export function isMediaRecoveryAction(value: unknown): value is MediaRecoveryAction {
  return typeof value === "string" && MEDIA_RECOVERY_ACTIONS.includes(value as MediaRecoveryAction);
}

export function getMediaRecoveryFailureLabel(code: string | null) {
  if (!code) return "تحتاج الحالة إلى تحقق جديد.";
  if (code.includes("finalization")) return "حُذف الملف، لكن لم يكتمل إنهاء سجل الحذف.";
  if (code.includes("storage")) return "تعذر إثبات حالة الملف في مكان الحفظ.";
  if (code.includes("reference")) return "ظهرت ارتباطات تمنع إكمال العملية.";
  if (code.includes("lease")) return "تعذر إكمال تنسيق عملية حفظ مرتبطة بالميديا.";
  return "تحتاج الحالة إلى مراجعة آمنة قبل أي تغيير.";
}
