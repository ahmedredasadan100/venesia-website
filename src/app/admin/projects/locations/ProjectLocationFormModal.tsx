"use client";

import { useRef } from "react";

import {
  ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME,
  AdminFormField,
  AdminFormGrid,
  AdminFormListboxSelect,
  AdminFormSwitch,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  VenesiaModal,
  adminFormFieldClassName,
} from "../../../../components/admin/ui";
import AdminFormRuntime, {
  AdminFormError,
  type AdminFormRuntimeHandle,
} from "../../../../components/admin/ui/AdminFormRuntime";
import {
  PROJECT_LOCATION_LEVEL_CONFIG,
  type ProjectLocationLevel,
  type ProjectLocationManagementRow,
  type ProjectLocationParentOption,
} from "../../../../lib/admin/projects/location-management-contract";
import {
  createProjectLocationAction,
  updateProjectLocationAction,
  type ProjectLocationFormActionState,
} from "./actions";

type ProjectLocationFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  level: ProjectLocationLevel;
  location?: ProjectLocationManagementRow;
  parentOptions: ProjectLocationParentOption[];
  onClose: () => void;
  onSaved: (location: ProjectLocationManagementRow) => void;
};

function parentOptionLabel(option: ProjectLocationParentOption) {
  const label = option.name_en
    ? `${option.name_ar} — ${option.name_en}`
    : option.name_ar;
  return option.is_active ? label : `${label} — غير نشط`;
}

export default function ProjectLocationFormModal({
  open,
  mode,
  level,
  location,
  parentOptions,
  onClose,
  onSaved,
}: ProjectLocationFormModalProps) {
  const runtimeRef = useRef<AdminFormRuntimeHandle>(null);
  const config = PROJECT_LOCATION_LEVEL_CONFIG[level];
  const action = mode === "create"
    ? createProjectLocationAction
    : updateProjectLocationAction;
  const parentSelectOptions = parentOptions.map((option) => ({
    value: String(option.id),
    label: parentOptionLabel(option),
    disabled: !option.is_active && option.id !== location?.parent_id,
  }));

  function handleSuccess(state: ProjectLocationFormActionState) {
    if (!state.result) return;
    onSaved(state.result);
    onClose();
  }

  return (
    <VenesiaModal
      open={open}
      title={mode === "create" ? `إضافة ${config.singularLabel}` : `تعديل ${config.singularLabel}`}
      description="احفظ الاسم والعلاقة والحالة والترتيب داخل مصدر مواقع المشاريع المعتمد."
      size="lg"
      onClose={() => runtimeRef.current?.requestClose()}
    >
      <AdminFormRuntime<ProjectLocationManagementRow>
        action={action}
        mode={mode}
        entityKey={`project-location:${level}:${location?.id ?? "new"}`}
        onClose={onClose}
        onSuccess={handleSuccess}
        runtimeRef={runtimeRef}
        formId={`project-location-${level}-${mode}`}
        className="space-y-5"
      >
        {({ fieldErrors, pending, requestClose }) => (
          <>
            <input type="hidden" name="level" value={level} />
            {location ? <input type="hidden" name="id" value={location.id} /> : null}

            <AdminFormGrid>
              <AdminFormField label="الاسم بالعربية" required>
                <input
                  name="name_ar"
                  defaultValue={location?.name_ar ?? ""}
                  required
                  disabled={pending}
                  className={adminFormFieldClassName(
                    fieldErrors.name_ar?.length ? "border-red-400/40" : "",
                  )}
                  aria-invalid={Boolean(fieldErrors.name_ar?.length)}
                  aria-describedby={fieldErrors.name_ar?.length ? "name_ar-error" : undefined}
                />
                <AdminFormError name="name_ar" />
              </AdminFormField>

              <AdminFormField label="الاسم بالإنجليزية">
                <input
                  name="name_en"
                  defaultValue={location?.name_en ?? ""}
                  disabled={pending}
                  dir="ltr"
                  className={adminFormFieldClassName()}
                />
              </AdminFormField>
            </AdminFormGrid>

            {config.parentLevel ? (
              <AdminFormListboxSelect
                name="parent_id"
                focusTargetId="parent_id"
                label={config.parentLabel ?? "العنصر الأب"}
                options={parentSelectOptions}
                defaultValue={location?.parent_id ? String(location.parent_id) : ""}
                placeholder={`اختر ${config.parentLabel ?? "العنصر الأب"}`}
                searchPlaceholder="ابحث في العناصر المتاحة"
                searchable={parentSelectOptions.length > 7}
                required
                disabled={pending || parentSelectOptions.length === 0}
                error={fieldErrors.parent_id?.[0] ?? null}
                emptyMessage="لا توجد عناصر أب متاحة. أضف المستوى السابق أولًا."
              />
            ) : null}

            <AdminFormGrid>
              <AdminFormField label="الترتيب" required>
                <input
                  name="sort_order"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={location?.sort_order ?? 0}
                  required
                  disabled={pending}
                  className={adminFormFieldClassName(
                    fieldErrors.sort_order?.length ? "border-red-400/40" : "",
                  )}
                  aria-invalid={Boolean(fieldErrors.sort_order?.length)}
                  aria-describedby={fieldErrors.sort_order?.length ? "sort_order-error" : undefined}
                />
                <AdminFormError name="sort_order" />
              </AdminFormField>

              <div className={`${ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME} flex items-center`}>
                <AdminFormSwitch
                  name="is_active"
                  label="نشط"
                  defaultChecked={location?.is_active ?? true}
                  disabled={pending}
                />
              </div>
            </AdminFormGrid>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <AdminModalCancelButton onClick={requestClose} disabled={pending}>
                إلغاء
              </AdminModalCancelButton>
              <AdminModalPrimaryButton type="submit" disabled={pending}>
                {pending ? "جارٍ الحفظ…" : mode === "create" ? "إضافة" : "حفظ"}
              </AdminModalPrimaryButton>
            </div>
          </>
        )}
      </AdminFormRuntime>
    </VenesiaModal>
  );
}
