"use client";

import { AdminMediaImageField } from "../../../../components/admin/media";
import {
  AdminFormActions,
  AdminFormError,
  AdminFormField,
  AdminFormGrid,
  AdminFormRuntime,
  AdminFormSection,
  adminFormFieldClassName,
} from "../../../../components/admin/ui";
import type { ResolvedAdminCompanyConfig } from "../../../../lib/admin/shell/contracts";
import { updateAdminCompanyAction } from "./actions";

export default function CompanyIdentityPanel({
  company,
}: {
  company: ResolvedAdminCompanyConfig;
}) {
  const textFields = [
    { name: "key", label: "Company key", value: company.key, dir: "ltr" as const },
    { name: "name", label: "اسم الشركة", value: company.name },
    { name: "adminLabel", label: "عنوان الإدارة", value: company.adminLabel },
    { name: "cmsLabel", label: "CMS label", value: company.cmsLabel, dir: "ltr" as const },
    {
      name: "publicWebsiteUrl",
      label: "رابط الموقع العام",
      value: company.publicWebsiteUrl,
      dir: "ltr" as const,
    },
  ];
  const colorFields = [
    ["accentColor", "اللون الأساسي", company.accentColor],
    ["accentStrongColor", "اللون البارز", company.accentStrongColor],
    ["surfaceColor", "لون الخلفية", company.surfaceColor],
  ] as const;

  return (
    <section data-admin-company-settings>
      <AdminFormRuntime
        action={updateAdminCompanyAction}
        mode="edit"
        entityKey="admin-company-identity"
        closeHref="/admin"
        className="space-y-6"
      >
        {({ fieldErrors }) => (
          <>
            <AdminFormSection
              title="هوية لوحة الإدارة"
              description="الهوية والألوان والشعارات هنا تخص الـAdmin Shell ولا تغير بيانات المحتوى."
              actions={
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/45">
                  المصدر: {company.source}
                </span>
              }
            >
              <AdminFormError className="mb-5" />

              <AdminFormGrid>
                {textFields.map(({ name, label, value, dir }) => (
                  <AdminFormField key={name} label={label} required>
                    <input
                      name={name}
                      defaultValue={value}
                      required
                      dir={dir}
                      className={adminFormFieldClassName(
                        fieldErrors[name]?.length ? "border-red-400/40" : "",
                      )}
                      aria-invalid={Boolean(fieldErrors[name]?.length)}
                      aria-describedby={
                        fieldErrors[name]?.length ? `${name}-error` : undefined
                      }
                    />
                    <AdminFormError name={name} />
                  </AdminFormField>
                ))}
              </AdminFormGrid>

              <AdminFormGrid className="mt-6">
                <div>
                  <AdminMediaImageField
                    name="logoUrl"
                    label="الشعار الرئيسي"
                    defaultValue={company.logoUrl}
                    browseFolder="images"
                  />
                  <AdminFormError name="logoUrl" />
                </div>
                <div>
                  <AdminMediaImageField
                    name="compactLogoUrl"
                    label="الشعار المصغر"
                    defaultValue={company.compactLogoUrl}
                    browseFolder="images"
                  />
                  <AdminFormError name="compactLogoUrl" />
                </div>
              </AdminFormGrid>

              <AdminFormGrid columns={3} className="mt-6">
                {colorFields.map(([name, label, value]) => (
                  <AdminFormField key={name} label={label} required>
                    <span
                      className={`flex items-center gap-3 rounded-2xl border bg-black/25 p-2 ${
                        fieldErrors[name]?.length
                          ? "border-red-400/40"
                          : "border-white/10"
                      }`}
                    >
                      <input
                        name={name}
                        type="color"
                        defaultValue={value}
                        className="size-10 rounded-xl border-0 bg-transparent"
                        aria-label={label}
                        aria-invalid={Boolean(fieldErrors[name]?.length)}
                        aria-describedby={
                          fieldErrors[name]?.length ? `${name}-error` : undefined
                        }
                      />
                      <span
                        dir="ltr"
                        className="min-w-0 flex-1 px-2 text-sm text-white/65"
                      >
                        {value}
                      </span>
                    </span>
                    <AdminFormError name={name} />
                  </AdminFormField>
                ))}
              </AdminFormGrid>
            </AdminFormSection>

            <AdminFormActions
              submitLabel="حفظ هوية الإدارة"
              pendingLabel="جارٍ الحفظ…"
              closeLabel="العودة إلى لوحة الإدارة"
              title="إجراءات هوية لوحة الإدارة"
              description="احفظ الهوية أو عد إلى لوحة الإدارة دون تغيير القيم المحفوظة."
            />
          </>
        )}
      </AdminFormRuntime>
    </section>
  );
}
