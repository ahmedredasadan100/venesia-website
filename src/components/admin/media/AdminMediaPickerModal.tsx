"use client";

import VenesiaModal from "../VenesiaModal";
import MediaLibraryCore from "./MediaLibraryCore";

type AdminMediaPickerModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  onSelectMany?: (paths: string[]) => void;
  initialFolder?: string;
  mode?: "image" | "pdf";
  multiple?: boolean;
  /** Kept for source compatibility. Picker replacement selects a new asset; it never overwrites this path. */
  replacePath?: string | null;
};

export default function AdminMediaPickerModal({
  open,
  onClose,
  onSelect,
  onSelectMany,
  initialFolder,
  mode = "image",
  multiple = false,
}: AdminMediaPickerModalProps) {
  if (!open) return null;

  return (
    <div data-media-picker-root="" className="contents">
      <VenesiaModal
        open={open}
        title={
          mode === "pdf"
            ? "اختيار مستند من المكتبة"
            : "اختيار صورة من المكتبة"
        }
        description="التحديد لا يغيّر الحقل. اضغط «تأكيد الاختيار» بعد المراجعة."
        size="xl"
        closeOnEscape
        bodyClassName="flex flex-col !overflow-hidden !p-0"
        onClose={onClose}
      >
        <div
          className="admin-scrollbar min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5"
          data-media-picker-scroll=""
        >
          <MediaLibraryCore
            mode={multiple ? "select-many" : "select-one"}
            initialFolder={initialFolder || (mode === "pdf" ? "files" : "images")}
            initialKind={mode === "pdf" ? "document" : "image"}
            onCancelSelection={onClose}
            onConfirmSelection={(paths) => {
              if (multiple) onSelectMany?.(paths);
              else if (paths[0]) onSelect(paths[0]);
              onClose();
            }}
          />
        </div>
      </VenesiaModal>
    </div>
  );
}
