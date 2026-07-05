import AdminMediaImageField from "../../../../components/admin/media/AdminMediaImageField";
import { AdminActionButton } from "../../../../components/admin/ui";
import TopicMarkdownEditor from "../../topics/TopicMarkdownEditor";
import TopicSlugInput from "../../topics/TopicSlugInput";
import { MEDIA_SECTION_OPTIONS } from "./media-content-config";
import { createMediaContent, updateMediaContent } from "./actions";

type MediaContentFormValues = {
  id?: number;
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  content?: string | null;
  image?: string | null;
  category_slug?: string | null;
  status?: string | null;
  is_featured?: boolean | null;
};

type MediaContentFormProps = {
  mode: "create" | "edit";
  values?: MediaContentFormValues | null;
};

const DEFAULT_CONTENT = "# عنوان المحتوى\n\nابدأ كتابة المحتوى هنا...\n\n## عنوان فرعي\n\nاكتب الفقرة هنا...";

export default function MediaContentForm({ mode, values }: MediaContentFormProps) {
  const action = mode === "edit" ? updateMediaContent : createMediaContent;
  const content = values?.content?.trim() ? values.content : DEFAULT_CONTENT;

  return (
    <form action={action} className="space-y-7" noValidate>
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="grid gap-6 lg:grid-cols-2">
          <label className="block lg:col-span-2">
            <span className="text-sm font-medium text-white/70">العنوان</span>
            <input
              name="title"
              required
              defaultValue={values?.title ?? ""}
              placeholder="اكتب عنوان المحتوى الإعلامي، مثل: Venesia تطلق بيانًا صحفيًا جديدًا"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-xl font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
            />
          </label>

          <TopicSlugInput defaultValue={values?.slug ?? ""} />

          <label className="block">
            <span className="text-sm font-medium text-white/70">قسم المركز الإعلامي</span>
            <select
              name="category_slug"
              required
              defaultValue={values?.category_slug ?? ""}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45"
            >
              <option value="">اختر القسم</option>
              {MEDIA_SECTION_OPTIONS.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-white/70">الحالة</span>
            <select
              name="status"
              defaultValue={values?.status ?? "draft"}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45"
            >
              <option value="draft">مسودة</option>
              <option value="published">منشور</option>
              <option value="unpublished">مخفي</option>
              <option value="archived">أرشيف</option>
            </select>
          </label>

          <label className="block lg:col-span-2">
            <span className="text-sm font-medium text-white/70">الموجز</span>
            <textarea
              name="excerpt"
              rows={4}
              defaultValue={values?.excerpt ?? ""}
              placeholder="ملخص قصير يظهر في قائمة المركز الإعلامي..."
              className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
            />
          </label>

          <div className="lg:col-span-2">
            <AdminMediaImageField
              name="image"
              label="الصورة الرئيسية"
              defaultValue={values?.image ?? ""}
              browseFolder="images/topics"
              dimensionHint="content"
              helperText="اختر صورة من المكتبة أو ارفع صورة جديدة — يتم حفظ المسار تلقائيًا."
            />
          </div>

          <label className={`flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 lg:col-span-2 ${values?.is_featured ? "" : ""}`}>
            <span className="text-sm font-medium text-white/70">مميز</span>
            <input
              type="checkbox"
              name="is_featured"
              defaultChecked={Boolean(values?.is_featured)}
              className="h-4 w-4 accent-[#D8B87A]"
            />
          </label>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">المحتوى</h2>
          <p className="mt-1 text-sm text-white/45">اكتب المحتوى بصيغة Markdown.</p>
        </div>
        <TopicMarkdownEditor defaultValue={content} />
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <AdminActionButton href="/admin/content/media" variant="dark">
          إلغاء
        </AdminActionButton>
        <button
          type="submit"
          className="rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]"
        >
          {mode === "edit" ? "حفظ التعديلات" : "إنشاء المحتوى"}
        </button>
      </div>
    </form>
  );
}
