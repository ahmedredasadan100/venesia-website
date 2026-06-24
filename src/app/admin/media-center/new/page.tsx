import Link from "next/link";
import AdminNotice from "../../../../components/admin/AdminNotice";
import AdminPageHeader from "../../../../components/admin/AdminPageHeader";
import SeoPanel from "../../../../components/admin/SeoPanel";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import TopicMarkdownEditor from "../../topics/TopicMarkdownEditor";
import TopicSlugInput from "../../topics/TopicSlugInput";
import MediaAdminTabs from "../_components/MediaAdminTabs";
import MediaImageField from "../_components/MediaImageField";
import { createMediaItem } from "../actions";
import { MEDIA_TYPE_CONFIG, MEDIA_TYPES, getMediaAdminPath, isMediaAdminType, type MediaAdminType } from "../_components/media-admin-config";

export const dynamic = "force-dynamic";

type CategoryRow = { name: string; slug: string };

function getErrorMessage(error?: string) {
  return error ? decodeURIComponent(error) : null;
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export default async function NewMediaItemPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string; error?: string }>;
}) {
  const params = await searchParams;
  const defaultType: MediaAdminType = isMediaAdminType(params?.type ?? null) ? (params?.type as MediaAdminType) : "news";
  const errorMessage = getErrorMessage(params?.error);

  const { data: categories } = await getSupabaseAdmin()
    .from("media_categories")
    .select("name, slug")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const safeCategories = (categories ?? []) as CategoryRow[];

  return (
    <main className="space-y-7">
      <AdminPageHeader
        eyebrow="NEW MEDIA ITEM"
        title="إضافة عنصر جديد للمركز الإعلامي"
        description="أضف خبرًا، فيديو، جاليري، بيانًا صحفيًا، أو تحديث موقع بنفس منهج إدارة موضوعات تهمك، مع ربط كل عنصر بتصنيف داخل قاعدة البيانات."
        actions={
          <>
            <Link href={getMediaAdminPath(defaultType)} className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/65 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]">
              رجوع للقائمة
            </Link>
          </>
        }
      />

      <MediaAdminTabs activeType={defaultType} />
      {errorMessage ? <AdminNotice variant="danger" title="تعذر إنشاء العنصر" message={errorMessage} /> : null}

      <form action={createMediaItem} className="space-y-7">
        <section className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-7">
            <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <div className="grid gap-6 lg:grid-cols-2">
                <label className="block lg:col-span-2">
                  <span className="text-sm font-medium text-white/70">عنوان العنصر</span>
                  <input name="title" required placeholder="مثال: تقدم أعمال المحارة الداخلية بمشروع D174" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-xl font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                </label>

                <TopicSlugInput defaultValue="" />

                <label className="block">
                  <span className="text-sm font-medium text-white/70">نوع المحتوى</span>
                  <select name="type" required defaultValue={defaultType} className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45">
                    {MEDIA_TYPES.map((type) => <option key={type} value={type}>{MEDIA_TYPE_CONFIG[type].plural}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-white/70">التصنيف</span>
                  <select name="category_slug" required defaultValue="" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45">
                    <option value="">اختر التصنيف</option>
                    {safeCategories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
                  </select>
                </label>

                <label className="block lg:col-span-2">
                  <span className="text-sm font-medium text-white/70">الوصف المختصر</span>
                  <textarea name="excerpt" required minLength={20} rows={4} placeholder="اكتب وصفًا مختصرًا واضحًا يظهر في كروت المركز الإعلامي ونتائج البحث." className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                </label>

                <MediaImageField />
              </div>
            </section>

            <TopicMarkdownEditor defaultValue="" />
          </div>

          <aside className="space-y-7">
            <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">PUBLISHING</p>
              <h3 className="mt-3 text-xl font-semibold text-white">إعدادات الظهور</h3>
              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-white/70">تاريخ النشر</span>
                  <input type="date" name="published_at" defaultValue={getTodayInputValue()} className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45" />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-white/70">Date Label</span>
                  <input name="date_label" placeholder="مثال: 29 مايو 2026" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-white/70">المشروع المرتبط</span>
                  <input name="project" placeholder="D174 / F92 / C35" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-white/70">مدة الفيديو</span>
                  <input name="duration" placeholder="01:12" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/70">
                  <span>عنصر مميز</span>
                  <input type="checkbox" name="is_featured" className="h-4 w-4 accent-[#D8B87A]" />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/70">
                  <span>عنصر شائع</span>
                  <input type="checkbox" name="is_popular" className="h-4 w-4 accent-[#D8B87A]" />
                </label>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">SCHEMA</p>
              <h3 className="mt-3 text-xl font-semibold text-white">بيانات تقنية</h3>
              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-white/70">Schema Type</span>
                  <input name="schema_type" defaultValue="Article" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-white/70">OG Image</span>
                  <input name="og_image" placeholder="اختياري، الافتراضي هو الصورة الرئيسية" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                </label>
              </div>
            </section>
          </aside>
        </section>

        <SeoPanel title="" excerpt="" slug="" content="" image="" imageAlt="" seoTitle="" seoDescription="" seoKeywords={[]} focusKeyword="" />

        <div className="sticky bottom-5 z-40 rounded-[26px] border border-white/10 bg-[#080B10]/95 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="submit" name="status" value="draft" className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/65 transition hover:border-white/30 hover:text-white">إنشاء كمسودة</button>
            <button type="submit" name="status" value="published" className="rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]">إنشاء ونشر</button>
          </div>
        </div>
      </form>
    </main>
  );
}
