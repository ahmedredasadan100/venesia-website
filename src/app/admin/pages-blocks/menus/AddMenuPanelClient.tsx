"use client";

import { useRef, useState } from "react";

import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import {
  AdminActionButton,
  AdminFormError,
  AdminFormField,
  AdminFormGrid,
  AdminFormListboxSelect,
  AdminFormRuntime,
  AdminFormSwitch,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  AdminSlugField,
  VenesiaModal,
  adminFormFieldClassName,
} from "../../../../components/admin/ui";
import type { AdminFormRuntimeHandle } from "../../../../components/admin/ui/AdminFormRuntime";
import { createMenu } from "./actions";

const MENU_LOCATION_OPTIONS = [
  { value: "main", label: "Header / Main" },
  { value: "mobile", label: "Mobile" },
  { value: "footer", label: "Footer" },
  { value: "custom", label: "Custom" },
] as const;

export default function AddMenuPanelClient() {
  const [open, setOpen] = useState(false);
  const runtimeRef = useRef<AdminFormRuntimeHandle>(null);

  function openPanel() {
    setOpen(true);
  }

  function requestClose() {
    runtimeRef.current?.requestClose();
  }

  return (
    <>
      <AdminActionButton variant="primary" onClick={openPanel}>
        <PlusIcon />
        إضافة منيو
      </AdminActionButton>

      <VenesiaModal
        open={open}
        title="إضافة قائمة جديدة"
        description="اعمل قائمة فاضية الآن، وافتحها بعد الإنشاء لإضافة عناصرها."
        size="md"
        onClose={requestClose}
      >
        <AdminFormRuntime
          action={createMenu}
          mode="create"
          entityKey="menu-quick-create"
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
          runtimeRef={runtimeRef}
          formId="create-menu-form"
          className="space-y-5"
        >
          {({ fieldErrors, pending, requestClose: requestRuntimeClose }) => (
            <>
              <AdminFormError />

              <AdminFormGrid>
                <AdminFormField label="الاسم العربي" required>
                  <input
                    name="name"
                    required
                    placeholder="مثال: القائمة الرئيسية"
                    dir="rtl"
                    className={adminFormFieldClassName(
                      fieldErrors.name?.length ? "border-red-400/40" : "",
                    )}
                    aria-invalid={Boolean(fieldErrors.name?.length)}
                    aria-describedby={
                      fieldErrors.name?.length ? "name-error" : undefined
                    }
                  />
                  <AdminFormError name="name" />
                </AdminFormField>

                <AdminSlugField
                  sourceInputName="name"
                  error={fieldErrors.slug?.[0] ?? null}
                />
              </AdminFormGrid>

              <AdminFormListboxSelect
                name="location"
                focusTargetId="location"
                label="مكان الاستخدام"
                options={MENU_LOCATION_OPTIONS}
                defaultValue="main"
                disabled={pending}
                error={fieldErrors.location?.[0] ?? null}
              />

              <AdminFormSwitch
                name="is_active"
                label="نشطة"
                defaultChecked
                disabled={pending}
                surface
              />

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <AdminModalCancelButton
                  onClick={requestRuntimeClose}
                  disabled={pending}
                >
                  إلغاء
                </AdminModalCancelButton>
                <AdminModalPrimaryButton type="submit" disabled={pending}>
                  {pending ? "جار الإنشاء..." : "إنشاء وفتح القائمة"}
                </AdminModalPrimaryButton>
              </div>
            </>
          )}
        </AdminFormRuntime>
      </VenesiaModal>
    </>
  );
}
