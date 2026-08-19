"use client";

import { useRef } from "react";

import {
  createTrackingItemAction,
  createTrackingStageAction,
  createTrackingUpdateAction,
  saveTrackingProfileAction,
  updateTrackingItemAction,
  updateTrackingStageAction,
  updateTrackingUpdateAction,
} from "../../../../app/admin/projects/tracking-actions";
import type {
  TrackingItemRow,
  TrackingStageMetrics,
  TrackingStageRow,
  TrackingUpdateRow,
} from "../../../../lib/admin/projects/tracking-contract";
import AdminMediaGalleryField from "../../media/AdminMediaGalleryField";
import {
  ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME,
  AdminFormField,
  AdminFormGrid,
  AdminFormGridItem,
  AdminFormListboxSelect,
  AdminFormSwitch,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  VenesiaModal,
  adminFormFieldClassName,
} from "../../ui";
import AdminFormRuntime, {
  AdminFormError,
  type AdminFormRuntimeHandle,
} from "../../ui/AdminFormRuntime";
import TrackingVideoFields from "./TrackingVideoFields";

const field = adminFormFieldClassName();
type ModalBase = { open: boolean; onClose: () => void; onSaved: () => void };
type SavedResult = { id: number };

export function TrackingProfileFormModal({
  open,
  onClose,
  onSaved,
  projectId,
  profile,
}: ModalBase & {
  projectId: number;
  profile: TrackingStageMetrics["profile"];
}) {
  const runtimeRef = useRef<AdminFormRuntimeHandle>(null);

  return (
    <VenesiaModal
      open={open}
      title="تعديل بيانات ملف المتابعة"
      description="هذه البيانات تخص Tracking Domain فقط، ولا تُنسخ إلى بيانات المشروع."
      size="lg"
      onClose={() => runtimeRef.current?.requestClose()}
    >
      <AdminFormRuntime<SavedResult>
        action={saveTrackingProfileAction}
        mode="edit"
        entityKey={`project-tracking-profile:${projectId}`}
        runtimeRef={runtimeRef}
        formId={`project-tracking-profile-${projectId}`}
        className="space-y-5"
        onClose={onClose}
        onSuccess={() => {
          onSaved();
          onClose();
        }}
      >
        {({ pending, requestClose }) => (
          <>
            <input type="hidden" name="project_id" value={projectId} />
            <AdminFormGrid>
              <AdminFormField label="تاريخ استلام المشروع">
                <input
                  name="project_receipt_date"
                  type="date"
                  defaultValue={profile?.project_receipt_date ?? ""}
                  disabled={pending}
                  className={field}
                />
                <AdminFormError name="project_receipt_date" />
              </AdminFormField>
              <AdminFormField label="تاريخ استلام الرخصة">
                <input
                  name="license_receipt_date"
                  type="date"
                  defaultValue={profile?.license_receipt_date ?? ""}
                  disabled={pending}
                  className={field}
                />
                <AdminFormError name="license_receipt_date" />
              </AdminFormField>
            </AdminFormGrid>
            <AdminFormField label="المقاول المنفذ">
              <input
                name="contractor_name"
                defaultValue={profile?.contractor_name ?? ""}
                disabled={pending}
                className={field}
              />
              <AdminFormError name="contractor_name" />
            </AdminFormField>
            <ModalActions pending={pending} requestClose={requestClose} />
          </>
        )}
      </AdminFormRuntime>
    </VenesiaModal>
  );
}

export function TrackingStageFormModal({
  open,
  onClose,
  onSaved,
  projectId,
  stage,
}: ModalBase & { projectId: number; stage?: TrackingStageRow }) {
  const runtimeRef = useRef<AdminFormRuntimeHandle>(null);
  const mode = stage ? ("edit" as const) : ("create" as const);
  return (
    <VenesiaModal
      open={open}
      title={stage ? "تعديل مرحلة التنفيذ" : "إضافة مرحلة تنفيذ"}
      description={
        stage
          ? "المرحلة ديناميكية، وحالتها تُشتق من حالات البنود ولا تُخزن هنا."
          : "بعد الحفظ ستنتقل مباشرة إلى إدارة بنود المرحلة الجديدة."
      }
      size="lg"
      onClose={() => runtimeRef.current?.requestClose()}
    >
      <AdminFormRuntime<SavedResult>
        action={stage ? updateTrackingStageAction : createTrackingStageAction}
        mode={mode}
        entityKey={`tracking-stage:${stage?.id ?? "new"}`}
        runtimeRef={runtimeRef}
        formId={`tracking-stage-${mode}`}
        className="space-y-5"
        onClose={onClose}
        onSuccess={() => {
          onSaved();
          onClose();
        }}
      >
        {({ pending, requestClose }) => (
          <>
            <input type="hidden" name="project_id" value={projectId} />
            {stage ? <input type="hidden" name="stage_id" value={stage.id} /> : null}
            <AdminFormField label="اسم المرحلة" required>
              <input
                name="name"
                defaultValue={stage?.name ?? ""}
                required
                disabled={pending}
                className={field}
              />
              <AdminFormError name="name" />
            </AdminFormField>
            <AdminFormField label="الوصف">
              <textarea
                name="description"
                defaultValue={stage?.description ?? ""}
                rows={3}
                disabled={pending}
                className={`${field} resize-y`}
              />
              <AdminFormError name="description" />
            </AdminFormField>
            <AdminFormGrid>
              <AdminFormField label="تاريخ البداية">
                <input
                  name="start_date"
                  type="date"
                  defaultValue={stage?.start_date ?? ""}
                  disabled={pending}
                  className={field}
                />
              </AdminFormField>
              <AdminFormField label="المدة المخططة">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="planned_duration_value"
                    type="number"
                    min={1}
                    defaultValue={stage?.planned_duration_value ?? ""}
                    disabled={pending}
                    className={field}
                  />
                  <AdminFormListboxSelect
                    name="planned_duration_unit"
                    focusTargetId="planned_duration_unit"
                    options={[
                      { value: "day", label: "يوم" },
                      { value: "week", label: "أسبوع" },
                      { value: "month", label: "شهر" },
                    ]}
                    defaultValue={stage?.planned_duration_unit ?? ""}
                    placeholder="الوحدة"
                    disabled={pending}
                  />
                </div>
                <AdminFormError name="planned_duration_value" />
              </AdminFormField>
            </AdminFormGrid>
            <div className={`${ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME} flex items-center`}>
              <AdminFormSwitch
                name="is_visible"
                label="مرئية في صفحة المتابعة"
                defaultChecked={stage?.is_visible ?? true}
                disabled={pending}
              />
            </div>
            <ModalActions pending={pending} requestClose={requestClose} />
          </>
        )}
      </AdminFormRuntime>
    </VenesiaModal>
  );
}

export function TrackingItemFormModal({
  open,
  onClose,
  onSaved,
  projectId,
  stageId,
  item,
}: ModalBase & {
  projectId: number;
  stageId: number;
  item?: TrackingItemRow;
}) {
  const runtimeRef = useRef<AdminFormRuntimeHandle>(null);
  const mode = item ? ("edit" as const) : ("create" as const);
  return (
    <VenesiaModal
      open={open}
      title={item ? "تعديل بند التنفيذ" : "إضافة بند تنفيذ"}
      description={
        item
          ? "حالة البند هي حقيقة التقدم التشغيلية الوحيدة؛ لا توجد نسب مئوية."
          : "بعد الحفظ ستنتقل مباشرة إلى سجل تحديثات البند وإدارة وسائطه."
      }
      size="lg"
      onClose={() => runtimeRef.current?.requestClose()}
    >
      <AdminFormRuntime<SavedResult>
        action={item ? updateTrackingItemAction : createTrackingItemAction}
        mode={mode}
        entityKey={`tracking-item:${item?.id ?? "new"}`}
        runtimeRef={runtimeRef}
        formId={`tracking-item-${mode}`}
        className="space-y-5"
        onClose={onClose}
        onSuccess={() => {
          onSaved();
          onClose();
        }}
      >
        {({ pending, requestClose }) => (
          <>
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="stage_id" value={stageId} />
            {item ? <input type="hidden" name="item_id" value={item.id} /> : null}
            <AdminFormField label="اسم البند" required>
              <input
                name="name"
                defaultValue={item?.name ?? ""}
                required
                disabled={pending}
                className={field}
              />
              <AdminFormError name="name" />
            </AdminFormField>
            <AdminFormField label="الوصف">
              <textarea
                name="description"
                defaultValue={item?.description ?? ""}
                rows={3}
                disabled={pending}
                className={`${field} resize-y`}
              />
            </AdminFormField>
            <AdminFormGrid columns={12}>
              <AdminFormGridItem span={4}>
                <AdminFormListboxSelect
                  name="status"
                  focusTargetId="status"
                  label="الحالة"
                  options={[
                    { value: "not_started", label: "لم يبدأ" },
                    { value: "in_progress", label: "جاري التنفيذ" },
                    { value: "completed", label: "مكتمل" },
                  ]}
                  defaultValue={item?.status ?? "not_started"}
                  required
                  disabled={pending}
                />
              </AdminFormGridItem>
              <AdminFormGridItem span={4}>
                <AdminFormField label="تاريخ البداية">
                  <input
                    name="start_date"
                    type="date"
                    defaultValue={item?.start_date ?? ""}
                    disabled={pending}
                    className={field}
                  />
                </AdminFormField>
              </AdminFormGridItem>
              <AdminFormGridItem span={4}>
                <AdminFormField label="تاريخ الإكمال">
                  <input
                    name="completion_date"
                    type="date"
                    defaultValue={item?.completion_date ?? ""}
                    disabled={pending}
                    className={field}
                  />
                  <AdminFormError name="completion_date" />
                </AdminFormField>
              </AdminFormGridItem>
            </AdminFormGrid>
            <div className={`${ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME} flex items-center`}>
              <AdminFormSwitch
                name="is_visible"
                label="مرئي في صفحة المتابعة"
                defaultChecked={item?.is_visible ?? true}
                disabled={pending}
              />
            </div>
            <ModalActions pending={pending} requestClose={requestClose} />
          </>
        )}
      </AdminFormRuntime>
    </VenesiaModal>
  );
}

export function TrackingUpdateFormModal({
  open,
  onClose,
  onSaved,
  projectId,
  itemId,
  update,
}: ModalBase & {
  projectId: number;
  itemId: number;
  update?: TrackingUpdateRow;
}) {
  const runtimeRef = useRef<AdminFormRuntimeHandle>(null);
  const mode = update ? ("edit" as const) : ("create" as const);
  return (
    <VenesiaModal
      open={open}
      title={update ? "تعديل تحديث التنفيذ" : "إضافة تحديث تاريخي"}
      description="كل حفظ ينشئ أو يعدل سجل Update محددًا؛ إضافة تحديث جديد لا تستبدل التاريخ السابق."
      size="xl"
      onClose={() => runtimeRef.current?.requestClose()}
    >
      <AdminFormRuntime<SavedResult>
        action={update ? updateTrackingUpdateAction : createTrackingUpdateAction}
        mode={mode}
        entityKey={`tracking-update:${update?.id ?? "new"}`}
        runtimeRef={runtimeRef}
        formId={`tracking-update-${mode}`}
        className="space-y-5"
        onClose={onClose}
        onSuccess={() => {
          onSaved();
          onClose();
        }}
      >
        {({ pending, requestClose }) => (
          <>
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="item_id" value={itemId} />
            {update ? <input type="hidden" name="update_id" value={update.id} /> : null}
            <AdminFormGrid columns={12}>
              <AdminFormGridItem span={6}>
                <AdminFormField label="عنوان التحديث" required>
                  <input
                    name="title"
                    defaultValue={update?.title ?? ""}
                    required
                    disabled={pending}
                    className={field}
                  />
                  <AdminFormError name="title" />
                </AdminFormField>
              </AdminFormGridItem>
              <AdminFormGridItem span={3}>
                <AdminFormField label="تاريخ التحديث" required>
                  <input
                    name="occurred_on"
                    type="date"
                    defaultValue={
                      update?.occurred_at.slice(0, 10) ??
                      new Date().toISOString().slice(0, 10)
                    }
                    required
                    disabled={pending}
                    className={field}
                  />
                  <AdminFormError name="occurred_on" />
                </AdminFormField>
              </AdminFormGridItem>
              <AdminFormGridItem span={3} className="flex items-end">
                <AdminFormSwitch
                  name="publication_status"
                  label="نشر"
                  value="published"
                  uncheckedValue="draft"
                  defaultChecked={update?.publication_status === "published"}
                  disabled={pending}
                  surface
                  className="w-full"
                />
              </AdminFormGridItem>
            </AdminFormGrid>
            <AdminFormField label="تفاصيل التحديث" required>
              <textarea
                name="body"
                defaultValue={update?.body ?? ""}
                rows={5}
                required
                disabled={pending}
                className={`${field} resize-y leading-7`}
              />
              <AdminFormError name="body" />
            </AdminFormField>
            <AdminMediaGalleryField
              name="image_urls"
              label="صور التحديث"
              defaultPaths={
                update?.media
                  .filter((item) => item.media_kind === "image")
                  .map((item) => item.public_url) ?? []
              }
              dimensionHint="content"
              browseFolder="images/projects"
              density="compact"
              helperText="يمكن إعادة استخدام الأصل نفسه في أكثر من تحديث؛ الحذف من التحديث يزيل المرجع فقط."
            />
            <TrackingVideoFields media={update?.media ?? []} />
            <AdminFormError name="image_urls" />
            <AdminFormError name="videos_json" />
            <ModalActions pending={pending} requestClose={requestClose} />
          </>
        )}
      </AdminFormRuntime>
    </VenesiaModal>
  );
}

function ModalActions({
  pending,
  requestClose,
}: {
  pending: boolean;
  requestClose: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
      <AdminModalCancelButton onClick={requestClose} disabled={pending}>
        إلغاء
      </AdminModalCancelButton>
      <AdminModalPrimaryButton type="submit" disabled={pending}>
        {pending ? "جارٍ الحفظ..." : "حفظ"}
      </AdminModalPrimaryButton>
    </div>
  );
}
