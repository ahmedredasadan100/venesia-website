"use client";

import { useActionState } from "react";

import { AdminMediaImageField } from "../../../../components/admin/media";
import type { ResolvedAdminCompanyConfig } from "../../../../lib/admin/shell/contracts";
import {
  ADMIN_COMPANY_ACTION_INITIAL,
  updateAdminCompanyAction,
} from "./actions";

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[var(--admin-accent)]/45";

function TextField({
  name,
  label,
  defaultValue,
  dir,
}: {
  name: string;
  label: string;
  defaultValue: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-semibold text-white/55">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required
        dir={dir}
        className={inputClass}
      />
    </label>
  );
}

export default function CompanyIdentityPanel({
  company,
}: {
  company: ResolvedAdminCompanyConfig;
}) {
  const [state, formAction, pending] = useActionState(
    updateAdminCompanyAction,
    ADMIN_COMPANY_ACTION_INITIAL,
  );

  return (
    <section className="admin-premium-card rounded-[28px] p-5" data-admin-company-settings>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">هوية لوحة الإدارة</h2>
          <p className="mt-1 text-sm leading-7 text-white/50">
            الهوية والألوان والشعارات هنا تخص الـAdmin Shell ولا تغير بيانات المحتوى.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/45">
          المصدر: {company.source}
        </span>
      </div>

      <form action={formAction} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="key" label="Company key" defaultValue={company.key} dir="ltr" />
          <TextField name="name" label="اسم الشركة" defaultValue={company.name} />
          <TextField name="adminLabel" label="عنوان الإدارة" defaultValue={company.adminLabel} />
          <TextField name="cmsLabel" label="CMS label" defaultValue={company.cmsLabel} dir="ltr" />
          <TextField name="publicWebsiteUrl" label="رابط الموقع العام" defaultValue={company.publicWebsiteUrl} dir="ltr" />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <AdminMediaImageField
            name="logoUrl"
            label="الشعار الرئيسي"
            defaultValue={company.logoUrl}
            browseFolder="images"
          />
          <AdminMediaImageField
            name="compactLogoUrl"
            label="الشعار المصغر"
            defaultValue={company.compactLogoUrl}
            browseFolder="images"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["accentColor", "اللون الأساسي", company.accentColor],
            ["accentStrongColor", "اللون البارز", company.accentStrongColor],
            ["surfaceColor", "لون الخلفية", company.surfaceColor],
          ].map(([name, label, value]) => (
            <label key={name} className="space-y-2">
              <span className="block text-xs font-semibold text-white/55">{label}</span>
              <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-2">
                <input name={name} type="color" defaultValue={value} className="size-10 rounded-xl border-0 bg-transparent" aria-label={label} />
                <span dir="ltr" className="min-w-0 flex-1 px-2 text-sm text-white/65">{value}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <p
            className={
              state.status === "error"
                ? "text-sm text-red-300"
                : state.status === "warning"
                  ? "text-sm text-amber-300"
                  : "text-sm text-emerald-300"
            }
            role="status"
          >
            {state.message}
          </p>
          <button type="submit" disabled={pending} className="rounded-2xl bg-[var(--admin-accent)] px-5 py-3 text-sm font-bold text-[#05070B] transition hover:brightness-110 disabled:opacity-50">
            {pending ? "جارٍ الحفظ…" : "حفظ هوية الإدارة"}
          </button>
        </div>
      </form>
    </section>
  );
}
