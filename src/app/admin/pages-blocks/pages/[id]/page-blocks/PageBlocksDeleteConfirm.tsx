import type { PageBlockAssignmentRow } from "../../../../../../lib/page-blocks/types";
import { moduleKindLabel } from "../../../../../../lib/page-blocks/admin-utils";

type PageBlocksDeleteConfirmProps = {
  assignment: PageBlockAssignmentRow;
  pageTitle: string;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer rounded-xl border border-white/10 p-2 text-white/50 hover:text-white">
      ×
    </button>
  );
}

export default function PageBlocksDeleteConfirm({
  assignment,
  pageTitle,
  isPending,
  onClose,
  onConfirm,
}: PageBlocksDeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#080B10] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.5)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-xl font-semibold text-white">تأكيد حذف الربط</h3>
            <p className="mt-1 text-sm text-white/45">يُحذف الربط من هذه الصفحة فقط — القالب يبقى في المكتبة.</p>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm leading-7 text-red-100">
          حذف {moduleKindLabel(assignment.module_kind)} «{assignment.template_name}» من {pageTitle}؟
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-2xl border border-white/10 px-5 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-white">
            إلغاء
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="cursor-pointer rounded-2xl bg-red-500 px-5 py-3 text-sm font-bold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            حذف الربط
          </button>
        </div>
      </div>
    </div>
  );
}
