"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AdminFeedbackRegion } from "../../../../components/admin/AdminFeedbackProvider";
import type { AdminActionFeedback } from "../../../../lib/admin/admin-action-feedback";
import type { GlobalSeoSettings, GlobalSeoSocialLink } from "../../../../lib/seo/global-seo-types";
import { saveGlobalSeoSettingsAction } from "./actions";

type MetaManagerClientProps = {
  initialSettings: GlobalSeoSettings;
};

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45";

export default function MetaManagerClient({ initialSettings }: MetaManagerClientProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<AdminActionFeedback | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const result = await saveGlobalSeoSettingsAction(formData);
        const warning =
          result.mediaSynchronization.status === "saved_with_media_sync_warning";
        setFeedback({
          variant: warning ? "warning" : "success",
          title: warning ? "تم الحفظ مع تحذير" : "تم حفظ إعدادات SEO",
          message: warning
            ? "تم حفظ إعدادات SEO، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا."
            : "تم حفظ إعدادات SEO العامة.",
          layout: "inline",
          dismissible: true,
          lifecycle: warning ? "persistent" : "manual",
        });
        router.refresh();
      } catch (submitError) {
        setFeedback({
          variant: "danger",
          title: "تعذر حفظ إعدادات SEO",
          message: submitError instanceof Error ? submitError.message : "تعذر حفظ الإعدادات.",
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 pb-10" dir="rtl">
      <AdminFeedbackRegion
        channel="seo-meta-manager"
        label="نتائج حفظ إعدادات SEO العامة"
        feedback={feedback}
      />

      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-white">القيم الافتراضية</h2>
        <label className="block text-sm text-white/70">
          اسم الموقع
          <input name="site_name" defaultValue={initialSettings.siteName} className={inputClass} />
        </label>
        <label className="block text-sm text-white/70">
          العنوان الافتراضي
          <input name="default_title" defaultValue={initialSettings.defaultTitle} className={inputClass} />
        </label>
        <label className="block text-sm text-white/70">
          الوصف الافتراضي
          <textarea
            name="default_description"
            rows={4}
            defaultValue={initialSettings.defaultDescription}
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-white/70">
          صورة OG الافتراضية (URL)
          <input name="default_og_image" defaultValue={initialSettings.defaultOgImage} className={inputClass} />
        </label>
        <label className="block text-sm text-white/70">
          نص بديل لصورة OG الافتراضية
          <input name="default_og_image_alt" defaultValue={initialSettings.defaultOgImageAlt} className={inputClass} />
        </label>
        <label className="block text-sm text-white/70">
          صورة Twitter الافتراضية (URL)
          <input
            name="default_twitter_image"
            defaultValue={initialSettings.defaultTwitterImage}
            className={inputClass}
          />
        </label>
        <div className="flex flex-wrap gap-6 text-sm text-white/75">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="default_robots_index"
              value="true"
              defaultChecked={initialSettings.defaultRobotsIndex}
            />
            Index افتراضي
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="default_robots_follow"
              value="true"
              defaultChecked={initialSettings.defaultRobotsFollow}
            />
            Follow افتراضي
          </label>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-white">الروابط الأساسية</h2>
        <label className="block text-sm text-white/70">
          Site URL
          <input name="site_url" defaultValue={initialSettings.siteUrl} className={inputClass} />
        </label>
        <label className="block text-sm text-white/70">
          Canonical Base URL
          <input
            name="canonical_base_url"
            defaultValue={initialSettings.canonicalBaseUrl}
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-white/70">
          Twitter Handle
          <input name="twitter_handle" defaultValue={initialSettings.twitterHandle} className={inputClass} />
        </label>
        <label className="block text-sm text-white/70">
          Google Site Verification
          <input
            name="google_site_verification"
            defaultValue={initialSettings.googleSiteVerification}
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-white/70">
          Bing Site Verification
          <input
            name="bing_site_verification"
            defaultValue={initialSettings.bingSiteVerification}
            className={inputClass}
          />
        </label>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-white">بيانات المنظمة</h2>
        <label className="block text-sm text-white/70">
          اسم المنظمة
          <input name="organization_name" defaultValue={initialSettings.organizationName} className={inputClass} />
        </label>
        <label className="block text-sm text-white/70">
          وصف المنظمة
          <textarea
            name="organization_description"
            rows={3}
            defaultValue={initialSettings.organizationDescription}
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-white/70">
          شعار المنظمة (URL)
          <input name="organization_logo" defaultValue={initialSettings.organizationLogo} className={inputClass} />
        </label>
        <label className="block text-sm text-white/70">
          الهاتف
          <input name="organization_phone" defaultValue={initialSettings.organizationPhone} className={inputClass} />
        </label>
        <label className="block text-sm text-white/70">
          البريد الإلكتروني
          <input name="organization_email" defaultValue={initialSettings.organizationEmail} className={inputClass} />
        </label>
        <label className="block text-sm text-white/70">
          العنوان
          <input
            name="organization_address"
            defaultValue={initialSettings.organizationAddress}
            className={inputClass}
          />
        </label>
        <div className="space-y-3">
          <p className="text-sm text-white/70">روابط التواصل الاجتماعي</p>
          {(initialSettings.organizationSocialLinks.length ? initialSettings.organizationSocialLinks : [{ label: "", href: "" }]).map(
            (link: GlobalSeoSocialLink, index: number) => (
              <div key={`${link.label}-${index}`} className="grid gap-3 md:grid-cols-2">
                <input
                  name="social_label"
                  defaultValue={link.label}
                  placeholder="Label"
                  className={inputClass}
                />
                <input name="social_href" defaultValue={link.href} placeholder="https://..." className={inputClass} />
              </div>
            ),
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <input name="social_label" placeholder="Label" className={inputClass} />
            <input name="social_href" placeholder="https://..." className={inputClass} />
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-2xl border border-[#D8B87A]/30 bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d] disabled:opacity-60"
      >
        {isPending ? "جاري الحفظ…" : "حفظ إعدادات SEO العامة"}
      </button>
    </form>
  );
}
