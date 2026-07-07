"use client";

import VenesiaModal, { AdminModalCancelButton, AdminModalPrimaryButton } from "../VenesiaModal";

export type BulkPublishFailure = {
  id: number;
  title: string;
  reason: string;
};

type BulkPublishValidationModalProps = {
  open: boolean;
  resourceLabel: string;
  validCount: number;
  failures: BulkPublishFailure[];
  onClose: () => void;
  onConfirmValidOnly: () => void;
};

export default function BulkPublishValidationModal({
  open,
  resourceLabel,
  validCount,
  failures,
  onClose,
  onConfirmValidOnly,
}: BulkPublishValidationModalProps) {
  const total = validCount + failures.length;
  const allInvalid = validCount === 0;

  return (
    <VenesiaModal
      open={open}
      onClose={onClose}
      title="مراجعة النشر الجماعي"
      description={
        allInvalid
          ? `لا يمكن نشر أي ${resourceLabel} من التحديد الحالي. راجع الأسباب ثم أصلح المحتوى.`
          : `تم فحص ${total} عنصرًا. ${validCount} جاهز للنشر و${failures.length} يحتاج إصلاحًا.`
      }
      size="lg"
    >
      <div className="space-y-4" dir="rtl">
        {failures.length > 0 ? (
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-[18px] border border-red-400/15 bg-red-500/5 p-4">
            <p className="text-sm font-semibold text-red-100">عناصر لن تُنشر</p>
            <ul className="space-y-3">
              {failures.map((failure) => (
                <li key={failure.id} className="rounded-[14px] border border-white/8 bg-black/20 p-3">
                  <p className="text-sm font-semibold text-white">{failure.title}</p>
                  <p className="mt-1 text-xs leading-6 text-white/55">{failure.reason}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <AdminModalCancelButton onClick={onClose}>إلغاء</AdminModalCancelButton>
          {!allInvalid ? (
            <AdminModalPrimaryButton onClick={onConfirmValidOnly}>
              نشر الصالح فقط ({validCount})
            </AdminModalPrimaryButton>
          ) : null}
        </div>
      </div>
    </VenesiaModal>
  );
}
