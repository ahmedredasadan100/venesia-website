import Link from "next/link";
import { notFound } from "next/navigation";
import AdminNotice from "../../../../../components/admin/AdminNotice";
import AdminPageHeader from "../../../../../components/admin/AdminPageHeader";
import AdminStatusBadge from "../../../../../components/admin/AdminStatusBadge";
import SeoPanel from "../../../../../components/admin/SeoPanel";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import TopicMarkdownEditor from "../../../topics/TopicMarkdownEditor";
import TopicSlugInput from "../../../topics/TopicSlugInput";
import MediaEditTabs from "../../MediaEditTabs";
import MediaSaveBar from "../../MediaSaveBar";
import MediaImageField from "../../_components/MediaImageField";
import {
  publishMediaItem,
  saveDraftMediaItem,
  saveMediaItem,
  saveMediaItemAndClose,
  unpublishMediaItem,
} from "../../actions";
import { MEDIA_TYPE_CONFIG, MEDIA_TYPES, getMediaAdminPath, getPublicMediaPath, isMediaAdminType, type MediaAdminType } from "../../_components/media-admin-config";

export const dynamic = "force-dynamic";

type CategoryRow = { name: string; slug: string };
type MediaRow = {
  id: number;
  slug: string | null;
  title: string | null;
  excerpt: string | null;
  content: string[] | string | null;
  image: string | null;
  image_alt: string | null;
  type: MediaAdminType | string | null;
  category_slug: string | null;
  project: string | null;
  duration: string | null;
  date_label: string | null;
  published_at: string | null;
  status: string | null;
  is_featured: boolean | null;
  is_popular: boolean | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  focus_keyword: string | null;
  og_image: string | null;
  schema_type: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function getNoticeText(notice?: string) {
  if (notice === "created") return "تم إنشاء عنصر المركز الإعلامي بنجاح.";
  if (notice === "saved") return "تم حفظ التعديلات بنجاح.";
  if (notice === "draft") return "تم حفظ العنصر كمسودة بنجاح.";
  if (notice === "published") return "تم نشر العنصر بنجاح.";
  if (notice === "unpublished") return "تم إخفاء العنصر بنجاح.";
  return null;
}

function getAdminStatus(status?: string | null) {
  if (status === "unpublished") return "hidden";
  return status || "draft";
}

function getContentText(value: MediaRow["content"]) {
  if (Array.isArray(value)) return value.filter(Boolean).join("\n\n");
  if (typeof value === "string") return value;
  return "";
}

function getSeoKeywords(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function formatDate(value?: string | null) {
  if (!value) return "غير متاح";
  return new Intl.DateTimeFormat("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function getDateInputValue(value?: string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export default async function EditMediaItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const [{ data: item }, { data: categories }] = await Promise.all([
    getSupabaseAdmin().from("media_items").select("*").eq("id", id).maybeSingle(),
    getSupabaseAdmin().from("media_categories").select("name, slug").eq("is_active", true).order("sort_order", { ascending: true }),
  ]);

  if (!item) notFound();

  const mediaItem = item as MediaRow;
  const safeCategories = (categories ?? []) as CategoryRow[];
  const type: MediaAdminType = isMediaAdminType(mediaItem.type) ? mediaItem.type : "news";
  const content = getContentText(mediaItem.content);
  const seoKeywords = getSeoKeywords(mediaItem.seo_keywords);
  const notice = getNoticeText(query?.notice);
  const errorMessage = query?.error ? decodeURIComponent(query.error) : null;
  const status = mediaItem.status || "draft";
  const listPath = getMediaAdminPath(type);

  return (
    <main className="space-y-7">
      <AdminPageHeader
        eyebrow="EDIT MEDIA ITEM"
        title={mediaItem.title || "تحرير عنصر إعلامي"}
        description="تحرير المحتوى، نوعه، تصنيفه، حالة النشر، السيو، والصورة الرئيسية من صفحة واحدة منظمة."
        actions={
          <>
            <AdminStatusBadge status={getAdminStatus(status)} />
            <Link href={listPath} className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/65 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]">
              رجوع للقائمة
            </Link>
            <Link href={`/admin/media-center/items/${mediaItem.id}/preview`} target="_blank" className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/70 transition hover:border-white/30 hover:text-white">
              معاينة داخلية
            </Link>
            {mediaItem.slug ? (
              <Link href={getPublicMediaPath(type, mediaItem.slug)} target="_blank" className="rounded-full border border-[#D8B87A]/35 px-5 py-3 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10">
                النسخة العامة
              </Link>
            ) : null}
          </>
        }
      />

      {notice ? <AdminNotice variant="success" message={notice} /> : null}
      {errorMessage ? <AdminNotice variant="danger" title="تعذر تنفيذ العملية" message={errorMessage} /> : null}

      <form action={saveMediaItem} className="space-y-7">
        <input type="hidden" name="id" value={mediaItem.id} />
        <input type="hidden" name="status" value={status} />

        <MediaEditTabs
          tabs={[
            {
              id: "basic",
              label: "البيانات الأساسية",
              content: (
                <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <label className="block lg:col-span-2">
                      <span className="text-sm font-medium text-white/70">عنوان العنصر</span>
                      <input name="title" required defaultValue={mediaItem.title ?? ""} className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-xl font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                    </label>

                    <TopicSlugInput defaultValue={mediaItem.slug ?? ""} />

                    <label className="block">
                      <span className="text-sm font-medium text-white/70">نوع المحتوى</span>
                      <select name="type" required defaultValue={type} className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45">
                        {MEDIA_TYPES.map((mediaType) => (
                          <option key={mediaType} value={mediaType}>
                            {MEDIA_TYPE_CONFIG[mediaType].plural}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-white/70">التصنيف</span>
                      <select name="category_slug" required defaultValue={mediaItem.category_slug ?? ""} className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45">
                        <option value="">اختر التصنيف</option>
                        {safeCategories.map((category) => (
                          <option key={category.slug} value={category.slug}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block lg:col-span-2">
                      <span className="text-sm font-medium text-white/70">الوصف المختصر</span>
                      <textarea name="excerpt" required minLength={20} rows={4} defaultValue={mediaItem.excerpt ?? ""} placeholder="اكتب وصفًا مختصرًا واضحًا يظهر في كروت المركز الإعلامي..." className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                    </label>
                  </div>
                </section>
              ),
            },
            {
              id: "content",
              label: "المحتوى",
              content: <TopicMarkdownEditor defaultValue={content} />,
            },
            {
              id: "media",
              label: "الصور / الفيديو",
              content: (
                <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="lg:col-span-2">
                      <MediaImageField defaultImage={mediaItem.image ?? ""} defaultAlt={mediaItem.image_alt ?? ""} />
                    </div>

                    <label className="block">
                      <span className="text-sm font-medium text-white/70">مدة الفيديو</span>
                      <input name="duration" defaultValue={mediaItem.duration ?? ""} placeholder="01:12" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-white/70">OG Image</span>
                      <input name="og_image" defaultValue={mediaItem.og_image ?? ""} placeholder="اختياري — الافتراضي هو الصورة الرئيسية" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                    </label>
                  </div>
                </section>
              ),
            },
            {
              id: "seo",
              label: "SEO",
              content: (
                <SeoPanel
                  title={mediaItem.title ?? ""}
                  excerpt={mediaItem.excerpt ?? ""}
                  slug={mediaItem.slug ?? ""}
                  content={content}
                  image={mediaItem.image ?? ""}
                  imageAlt={mediaItem.image_alt ?? ""}
                  seoTitle={mediaItem.seo_title ?? ""}
                  seoDescription={mediaItem.seo_description ?? ""}
                  seoKeywords={seoKeywords}
                  focusKeyword={mediaItem.focus_keyword ?? ""}
                />
              ),
            },
            {
              id: "publish",
              label: "النشر والإعدادات",
              content: (
                <section className="max-w-xl rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">PUBLISHING</p>
                  <h3 className="mt-3 text-xl font-semibold text-white">إعدادات الظهور</h3>
                  <div className="mt-6 space-y-4">
                    <InfoLine label="الحالة الحالية" value={status} />
                    <InfoLine label="الإنشاء" value={formatDate(mediaItem.created_at)} />
                    <InfoLine label="آخر تعديل" value={formatDate(mediaItem.updated_at)} />

                    <label className="block">
                      <span className="text-sm font-medium text-white/70">تاريخ النشر</span>
                      <input type="date" name="published_at" defaultValue={getDateInputValue(mediaItem.published_at)} className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45" />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-white/70">Date Label</span>
                      <input name="date_label" defaultValue={mediaItem.date_label ?? ""} placeholder="مثال: 29 مايو 2026" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-white/70">المشروع المرتبط</span>
                      <input name="project" defaultValue={mediaItem.project ?? ""} placeholder="D174 / F92 / C35" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-white/70">Schema Type</span>
                      <input name="schema_type" defaultValue={mediaItem.schema_type ?? "Article"} className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45" />
                    </label>

                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/70">
                      <span>عنصر مميز</span>
                      <input type="checkbox" name="is_featured" defaultChecked={Boolean(mediaItem.is_featured)} className="h-4 w-4 accent-[#D8B87A]" />
                    </label>

                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/70">
                      <span>عنصر شائع</span>
                      <input type="checkbox" name="is_popular" defaultChecked={Boolean(mediaItem.is_popular)} className="h-4 w-4 accent-[#D8B87A]" />
                    </label>
                  </div>
                </section>
              ),
            },
          ]}
        />

        <MediaSaveBar
          itemId={mediaItem.id}
          type={type}
          slug={mediaItem.slug}
          status={status}
          saveAction={saveMediaItem}
          saveAndCloseAction={saveMediaItemAndClose}
          draftAction={saveDraftMediaItem}
          publishAction={publishMediaItem}
          unpublishAction={unpublishMediaItem}
        />
      </form>
    </main>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      <p className="text-xs text-white/35">{label}</p>
      <p className="mt-1 text-sm text-white/70">{value}</p>
    </div>
  );
}
