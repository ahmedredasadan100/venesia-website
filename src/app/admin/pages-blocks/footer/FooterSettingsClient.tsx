"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import AdminModuleTabs from "../../../../components/admin/page-blocks/AdminModuleTabs";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { FooterContactItem, FooterSettings, FooterSocialLink } from "../../../../lib/footer/types";
import { updateFooterSettings } from "./actions";

const SOCIAL_PLATFORM_OPTIONS = [
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["youtube", "YouTube"],
  ["whatsapp", "WhatsApp"],
  ["location", "Location"],
] as const;

type FooterMenuItemRow = {
  id: number;
  label: string;
  href: string;
  sortOrder: number;
  visible: boolean;
};

type FooterSettingsClientProps = {
  settings: FooterSettings;
  footerMenuId: number | null;
  quickLinkItems: FooterMenuItemRow[];
  saved?: boolean;
};

function emptyContactRow(): FooterContactItem {
  return { label: "", value: "", href: "", icon: "", visible: true };
}

function emptySocialRow(): FooterSocialLink {
  return { platform: "whatsapp", label: "", href: "", visible: true };
}

function emptyQuickLinkRow(): FooterMenuItemRow {
  return { id: 0, label: "", href: "", sortOrder: 0, visible: true };
}

function ContactItemsEditor({ initialRows }: { initialRows: FooterContactItem[] }) {
  const [rows, setRows] = useState(initialRows.length ? initialRows : [emptyContactRow()]);

  return (
    <div className="space-y-4">
      {rows.map((item, index) => (
        <div key={`contact-${index}`} className="space-y-3 rounded-[24px] border border-white/10 bg-[#080B10]/72 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-white/75">عنصر تواصل #{index + 1}</p>
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
              className="rounded-xl border border-red-400/25 px-3 py-1.5 text-xs text-red-200 transition hover:bg-red-400/10"
            >
              حذف
            </button>
          </div>
          <input type="hidden" name="contact_visible" value={item.visible === false ? "false" : "true"} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-2 text-right">
              <span className="text-xs font-semibold text-white/55">التسمية</span>
              <input name="contact_label" defaultValue={item.label} className={fieldClassName()} dir="rtl" />
            </label>
            <label className="block space-y-2 text-right">
              <span className="text-xs font-semibold text-white/55">القيمة</span>
              <input name="contact_value" defaultValue={item.value} className={fieldClassName()} dir="rtl" />
            </label>
            <label className="block space-y-2 md:col-span-2 text-right">
              <span className="text-xs font-semibold text-white/55">الرابط (اختياري)</span>
              <input name="contact_href" defaultValue={item.href ?? ""} dir="ltr" className={fieldClassName()} />
            </label>
            <label className="block space-y-2 text-right">
              <span className="text-xs font-semibold text-white/55">أيقونة (اختياري)</span>
              <input name="contact_icon" defaultValue={item.icon ?? ""} className={fieldClassName()} />
            </label>
            <label className="flex h-[46px] items-center justify-end gap-3 self-end rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white/70">
              <span>إظهار في الفوتر</span>
              <input
                type="checkbox"
                defaultChecked={item.visible !== false}
                onChange={(event) => {
                  const visible = event.target.checked;
                  setRows((current) =>
                    current.map((row, rowIndex) => (rowIndex === index ? { ...row, visible } : row)),
                  );
                  const hidden = event.target.closest("div")?.querySelector('input[type="hidden"][name="contact_visible"]') as HTMLInputElement | null;
                  if (hidden) hidden.value = visible ? "true" : "false";
                }}
                className="h-4 w-4 accent-[#D8B87A]"
              />
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((current) => [...current, emptyContactRow()])}
        className="rounded-2xl border border-[#D8B87A]/30 px-4 py-2.5 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
      >
        + إضافة عنصر تواصل
      </button>
    </div>
  );
}

function SocialLinksEditor({ initialRows }: { initialRows: FooterSocialLink[] }) {
  const [rows, setRows] = useState(initialRows.length ? initialRows : [emptySocialRow()]);

  return (
    <div className="space-y-4">
      {rows.map((item, index) => (
        <div key={`social-${index}`} className="space-y-3 rounded-[24px] border border-white/10 bg-[#080B10]/72 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-white/75">رابط #{index + 1}</p>
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
              className="rounded-xl border border-red-400/25 px-3 py-1.5 text-xs text-red-200 transition hover:bg-red-400/10"
            >
              حذف
            </button>
          </div>
          <input type="hidden" name="social_visible" value={item.visible === false ? "false" : "true"} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-2 text-right">
              <span className="text-xs font-semibold text-white/55">المنصة</span>
              <select name="social_platform" defaultValue={item.platform} className={fieldClassName()}>
                {SOCIAL_PLATFORM_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2 text-right">
              <span className="text-xs font-semibold text-white/55">التسمية</span>
              <input name="social_label" defaultValue={item.label} className={fieldClassName()} dir="rtl" />
            </label>
            <label className="block space-y-2 md:col-span-2 text-right">
              <span className="text-xs font-semibold text-white/55">الرابط</span>
              <input name="social_href" defaultValue={item.href} dir="ltr" className={fieldClassName()} />
            </label>
            <label className="flex h-[46px] items-center justify-end gap-3 self-end rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white/70 md:col-span-2">
              <span>إظهار في الشريط السفلي</span>
              <input
                type="checkbox"
                defaultChecked={item.visible !== false}
                onChange={(event) => {
                  const visible = event.target.checked;
                  setRows((current) =>
                    current.map((row, rowIndex) => (rowIndex === index ? { ...row, visible } : row)),
                  );
                  const hidden = event.target.closest("div")?.querySelector('input[type="hidden"][name="social_visible"]') as HTMLInputElement | null;
                  if (hidden) hidden.value = visible ? "true" : "false";
                }}
                className="h-4 w-4 accent-[#D8B87A]"
              />
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((current) => [...current, emptySocialRow()])}
        className="rounded-2xl border border-[#D8B87A]/30 px-4 py-2.5 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
      >
        + إضافة رابط سوشيال
      </button>
      <p className="text-xs leading-6 text-white/42">
        هذه الروابط تظهر في شريط السوشيال أسفل الفوتر (FooterSocialBar)، وليس داخل أعمدة الفوتر.
      </p>
    </div>
  );
}

function QuickLinksEditor({
  footerMenuId,
  initialRows,
}: {
  footerMenuId: number | null;
  initialRows: FooterMenuItemRow[];
}) {
  const [rows, setRows] = useState(initialRows.length ? initialRows : footerMenuId ? [] : [emptyQuickLinkRow()]);

  if (!footerMenuId) {
    return (
      <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/5 p-5 text-sm leading-7 text-amber-100/85">
        لا توجد قائمة Footer نشطة. أنشئ قائمة بـ location = footer من{" "}
        <Link href="/admin/pages-blocks/menus" className="text-[#D8B87A] underline">
          إدارة القوائم
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="footer_menu_id" value={footerMenuId} />
      <p className="text-xs leading-6 text-white/45">
        الروابط السريعة = العمود الثالث في الفوتر العام. الترتيب هنا يطابق sort_order في القائمة.
      </p>
      {rows.map((item, index) => (
        <div key={`quicklink-${item.id}-${index}`} className="space-y-3 rounded-[24px] border border-white/10 bg-[#080B10]/72 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-white/75">رابط #{index + 1}</p>
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
              className="rounded-xl border border-red-400/25 px-3 py-1.5 text-xs text-red-200 transition hover:bg-red-400/10"
            >
              حذف
            </button>
          </div>
          <input type="hidden" name="quicklink_id" value={item.id || ""} />
          <input type="hidden" name="quicklink_visible" value={item.visible ? "true" : "false"} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-2 text-right">
              <span className="text-xs font-semibold text-white/55">النص</span>
              <input name="quicklink_label" defaultValue={item.label} className={fieldClassName()} dir="rtl" />
            </label>
            <label className="block space-y-2 text-right">
              <span className="text-xs font-semibold text-white/55">الرابط</span>
              <input name="quicklink_href" defaultValue={item.href} dir="ltr" className={fieldClassName()} />
            </label>
            <label className="block space-y-2 text-right">
              <span className="text-xs font-semibold text-white/55">الترتيب</span>
              <input
                name="quicklink_sort"
                type="number"
                defaultValue={item.sortOrder}
                className={fieldClassName()}
              />
            </label>
            <label className="flex h-[46px] items-center justify-end gap-3 self-end rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white/70">
              <span>إظهار</span>
              <input
                type="checkbox"
                defaultChecked={item.visible}
                onChange={(event) => {
                  const visible = event.target.checked;
                  setRows((current) =>
                    current.map((row, rowIndex) => (rowIndex === index ? { ...row, visible } : row)),
                  );
                  const hidden = event.target.closest("div")?.querySelector('input[type="hidden"][name="quicklink_visible"]') as HTMLInputElement | null;
                  if (hidden) hidden.value = visible ? "true" : "false";
                }}
                className="h-4 w-4 accent-[#D8B87A]"
              />
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((current) => [...current, { ...emptyQuickLinkRow(), sortOrder: current.length }])}
        className="rounded-2xl border border-[#D8B87A]/30 px-4 py-2.5 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
      >
        + إضافة رابط سريع
      </button>
    </div>
  );
}

export default function FooterSettingsClient({
  settings,
  footerMenuId,
  quickLinkItems,
  saved,
}: FooterSettingsClientProps) {
  const contactRows = useMemo(
    () => (settings.contactItems.length ? settings.contactItems : [emptyContactRow()]),
    [settings.contactItems],
  );
  const socialRows = useMemo(
    () => (settings.socialLinks.length ? settings.socialLinks : [emptySocialRow()]),
    [settings.socialLinks],
  );

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <section className="rounded-[34px] border border-white/10 bg-[#080B10]/78 p-6 shadow-[0_30px_110px_rgba(0,0,0,0.26)] backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">Footer CMS</p>
        <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">إعدادات الفوتر</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/56">
          Brand والتواصل والسوشيال والروابط السريعة وعناوين الأعمدة — كلها من هنا. عمود المركز الإعلامي يقرأ submenu من
          القائمة الرئيسية (main menu → /media-center).
        </p>
        {settings.usesFallback ? (
          <p className="mt-3 text-sm text-amber-300">تنبيه: بعض الإعدادات تُقرأ من fallback — شغّل seed script.</p>
        ) : null}
        {saved ? <p className="mt-3 text-sm text-emerald-300">تم حفظ إعدادات الفوتر بنجاح.</p> : null}
      </section>

      <form action={updateFooterSettings}>
        <AdminModuleTabs
          tabs={[
            {
              id: "general",
              label: "الإعدادات العامة",
              content: (
                <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                  <p className="text-xs text-white/40">العمود الأول (Brand) + حقوق النشر + عناوين أعمدة التواصل والمركز الإعلامي.</p>
                  <label className="block space-y-2 text-right">
                    <span className="text-xs font-semibold text-white/55">اسم البراند</span>
                    <input name="brand_title" required defaultValue={settings.brand.title} className={fieldClassName()} dir="rtl" />
                  </label>
                  <label className="block space-y-2 text-right">
                    <span className="text-xs font-semibold text-white/55">الشعار النصي (Tagline)</span>
                    <input name="brand_tagline" defaultValue={settings.brand.tagline} className={fieldClassName()} dir="rtl" />
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2 text-right">
                      <span className="text-xs font-semibold text-white/55">عنوان عمود التواصل</span>
                      <input
                        name="brand_contact_heading"
                        defaultValue={settings.brand.contactHeading}
                        className={fieldClassName()}
                        dir="rtl"
                      />
                    </label>
                    <label className="block space-y-2 text-right">
                      <span className="text-xs font-semibold text-white/55">عنوان عمود المركز الإعلامي</span>
                      <input
                        name="brand_media_heading"
                        defaultValue={settings.brand.mediaHeading}
                        className={fieldClassName()}
                        dir="rtl"
                      />
                    </label>
                  </div>
                  <div className="border-t border-white/10 pt-4">
                    <p className="mb-3 text-sm font-medium text-white/70">Legal</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block space-y-2 text-right">
                        <span className="text-xs font-semibold text-white/55">Copyright</span>
                        <input name="legal_copyright" defaultValue={settings.legal.copyright} className={fieldClassName()} />
                      </label>
                      <label className="block space-y-2 text-right">
                        <span className="text-xs font-semibold text-white/55">Legal Tagline</span>
                        <input name="legal_tagline" defaultValue={settings.legal.tagline} className={fieldClassName()} />
                      </label>
                    </div>
                  </div>
                </section>
              ),
            },
            {
              id: "quick-links",
              label: "الروابط السريعة",
              content: <QuickLinksEditor footerMenuId={footerMenuId} initialRows={quickLinkItems} />,
            },
            {
              id: "contact",
              label: "بيانات التواصل",
              content: <ContactItemsEditor initialRows={contactRows} />,
            },
            {
              id: "social",
              label: "السوشيال",
              content: <SocialLinksEditor initialRows={socialRows} />,
            },
            {
              id: "media-center",
              label: "المركز الإعلامي",
              content: (
                <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5 text-sm leading-7 text-white/58">
                  <p>
                    <strong className="text-white/80">مصدر عمود المركز الإعلامي:</strong> submenu تحت «المركز الإعلامي» في
                    القائمة الرئيسية (main menu).
                  </p>
                  <p>
                    <strong className="text-white/80">عنوان العمود:</strong> يُعدّل من تبويب «الإعدادات العامة» → «عنوان
                    عمود المركز الإعلامي».
                  </p>
                  <Link
                    href="/admin/pages-blocks/menus"
                    className="inline-flex rounded-2xl border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-2.5 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/15"
                  >
                    تعديل قائمة Main Menu
                  </Link>
                </section>
              ),
            },
          ]}
        />

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="rounded-2xl bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]"
          >
            حفظ إعدادات الفوتر
          </button>
        </div>
      </form>
    </div>
  );
}
