"use client";

import { useTransition } from "react";

import { AdminFeedbackRegion } from "../../../../../components/admin/AdminFeedbackProvider";
import { AdminFormField, AdminFormSection } from "../../../../../components/admin/ui";
import { savePageSeoAction } from "../page-seo-actions";

type PageSeoPanelProps = {
  pageId: number;
  path: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  notice?: string | null;
  error?: string | null;
};

export default function PageSeoPanel({
  pageId,
  path,
  seoTitle,
  seoDescription,
  seoKeywords,
  notice,
  error,
}: PageSeoPanelProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6" dir="rtl">
      <div className="mb-6 border-b border-white/10 pb-5">
        <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">PAGE SEO</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">إعدادات السيو للصفحة</h2>
        <p className="mt-2 text-sm leading-7 text-white/50">
          تُستخدم هذه القيم للمسار العام{" "}
          <span dir="ltr" className="font-en text-[#D8B87A]">
            {path || "/"}
          </span>{" "}
          عند توفرها، مع الاحتفاظ بقيم المسار الافتراضية كاحتياط.
        </p>
      </div>

      <AdminFeedbackRegion
        channel={`page-seo:${pageId}`}
        label="نتيجة حفظ إعدادات السيو"
        feedback={
          error
            ? {
                variant: "danger",
                title: "تعذر حفظ السيو",
                message: error,
                layout: "inline",
                dismissible: true,
                lifecycle: "manual",
                dismissSearchParams: ["error"],
              }
            : notice === "saved"
              ? {
                  variant: "success",
                  title: "تم الحفظ",
                  message: "تم حفظ إعدادات السيو للصفحة.",
                  layout: "inline",
                  dismissible: true,
                  lifecycle: "manual",
                  dismissSearchParams: ["notice"],
                }
              : null
        }
      />

      <form
        action={(formData) => {
          startTransition(() => savePageSeoAction(formData));
        }}
        className="space-y-5"
      >
        <input type="hidden" name="page_id" value={pageId} />
        <input
          type="hidden"
          name="redirect_to"
          value={`/admin/pages-blocks/pages/${pageId}?tab=seo`}
        />

        <AdminFormSection eyebrow="METADATA" title="العنوان والوصف" compactHeader>
          <div className="grid gap-5 lg:grid-cols-2">
            <AdminFormField label="SEO Title">
              <input
                name="seo_title"
                defaultValue={seoTitle}
                placeholder="عنوان يظهر في نتائج البحث..."
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
              />
            </AdminFormField>

            <AdminFormField label="SEO Keywords" hint="افصل بين الكلمات بفاصلة أو ;">
              <input
                name="seo_keywords"
                defaultValue={seoKeywords.join(", ")}
                placeholder="مثال: فينيسيا, مشاريع سكنية"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
              />
            </AdminFormField>
          </div>

          <AdminFormField label="Meta Description">
            <textarea
              name="seo_description"
              rows={4}
              defaultValue={seoDescription}
              placeholder="وصف مختصر للصفحة في نتائج البحث..."
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
            />
          </AdminFormField>
        </AdminFormSection>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-2xl bg-[#D8B87A] px-6 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "جارٍ الحفظ..." : "حفظ إعدادات السيو"}
          </button>
        </div>
      </form>
    </section>
  );
}
