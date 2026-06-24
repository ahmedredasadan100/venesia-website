import Link from "next/link";
import { notFound } from "next/navigation";
import AdminPageHeader from "../../../../../components/admin/AdminPageHeader";
import AdminRowActions, { CopyIcon, EyeIcon, EyeOffIcon, PencilIcon, PlusIcon, TrashIcon } from "../../../../../components/admin/AdminRowActions";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { createMenuItem, deleteMenuItem, duplicateMenuItem, toggleMenuItemVisibility, updateMenu, updateMenuItem } from "../actions";

type Menu = {
  id: number;
  name: string;
  slug: string;
  location: string;
  is_active: boolean;
};

type MenuItem = {
  id: number;
  menu_id: number;
  parent_id: number | null;
  label: string;
  item_type: string;
  href: string | null;
  linked_type: string | null;
  linked_id: number | null;
  anchor: string | null;
  target: string;
  css_class: string | null;
  style_preset: string | null;
  is_visible: boolean;
  sort_order: number;
};

type TreeMenuItem = MenuItem & { children: TreeMenuItem[] };

type ReferenceOption = {
  id: number;
  title?: string | null;
  name?: string | null;
  slug?: string | null;
};

type References = {
  topics: ReferenceOption[];
  categories: ReferenceOption[];
  projects: ReferenceOption[];
};

const pageOptions = [
  { label: "الرئيسية", href: "/" },
  { label: "من نحن", href: "/about" },
  { label: "مشروعاتنا", href: "/projects" },
  { label: "تابع مشروعك", href: "/track-your-project" },
  { label: "موضوعات تهمك", href: "/topics" },
  { label: "المركز الإعلامي", href: "/media-center" },
  { label: "الأخبار", href: "/media-center/news" },
  { label: "من أرض التنفيذ", href: "/media-center/site-updates" },
  { label: "الفيديوهات", href: "/media-center/videos" },
  { label: "البيانات الصحفية", href: "/media-center/press" },
  { label: "معرض الصور", href: "/media-center/gallery" },
  { label: "تواصل معنا", href: "/contact" },
];

function fieldClassName(extra = "") {
  return [
    "admin-select min-h-11 rounded-2xl border border-white/10 bg-[#0B0F16] px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#D8B87A]/45 focus:bg-[#111722]",
    extra,
  ].join(" ");
}

function labelClassName() {
  return "space-y-2 text-xs font-medium text-white/48";
}

function buildTree(items: MenuItem[], parentId: number | null = null): TreeMenuItem[] {
  return items
    .filter((item) => item.parent_id === parentId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((item) => ({ ...item, children: buildTree(items, item.id) }));
}

function getItemTypeLabel(type: string) {
  const labels: Record<string, string> = {
    custom: "رابط مخصص",
    page: "صفحة",
    topic: "موضوع",
    topic_category: "تصنيف",
    project: "مشروع",
    external: "خارجي",
    anchor: "Anchor",
    parent: "Parent",
  };

  return labels[type] ?? type;
}

function optionTitle(option: ReferenceOption) {
  return option.title ?? option.name ?? option.slug ?? `#${option.id}`;
}

function selectedReferenceId(item: MenuItem | undefined, type: string) {
  if (!item || item.item_type !== type) return "";
  return item.linked_id ?? "";
}

function flattenItems(items: TreeMenuItem[], level = 0): { item: TreeMenuItem; level: number }[] {
  return items.flatMap((item) => [{ item, level }, ...flattenItems(item.children, level + 1)]);
}

function MenuItemForm({
  menu,
  parentItems,
  references,
  item,
  defaultParentId,
  submitLabel,
  action,
}: {
  menu: Menu;
  parentItems: MenuItem[];
  references: References;
  item?: MenuItem;
  defaultParentId?: number | null;
  submitLabel: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="grid gap-4 rounded-[26px] border border-white/10 bg-white/[0.025] p-5 lg:grid-cols-12">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <input type="hidden" name="menu_id" value={menu.id} />

      <label className={`${labelClassName()} lg:col-span-2`}>
        Parent
        <select name="parent_id" defaultValue={item?.parent_id ?? defaultParentId ?? ""} className={fieldClassName("w-full")}>
          <option value="">بدون أب</option>
          {parentItems.filter((parent) => parent.id !== item?.id).map((parent) => (
            <option key={parent.id} value={parent.id}>{parent.label}</option>
          ))}
        </select>
      </label>

      <label className={`${labelClassName()} lg:col-span-2`}>
        الاسم
        <input name="label" defaultValue={item?.label ?? ""} placeholder="مثال: مشروعاتنا" className={fieldClassName("w-full")} />
      </label>

      <label className={`${labelClassName()} lg:col-span-2`}>
        النوع
        <select name="item_type" defaultValue={item?.item_type ?? "page"} className={fieldClassName("w-full")}>
          <option value="page">صفحة داخلية</option>
          <option value="topic">موضوع من قاعدة البيانات</option>
          <option value="topic_category">تصنيف من قاعدة البيانات</option>
          <option value="project">مشروع من قاعدة البيانات</option>
          <option value="external">رابط خارجي</option>
          <option value="anchor">Anchor</option>
          <option value="parent">Parent بدون رابط</option>
          <option value="custom">Custom</option>
        </select>
      </label>

      <label className={`${labelClassName()} lg:col-span-3`}>
        صفحة داخلية
        <select name="page_href" defaultValue={item?.item_type === "page" ? item.href ?? "/" : ""} className={fieldClassName("w-full")}>
          <option value="">اختار صفحة عند استخدام نوع صفحة داخلية</option>
          {pageOptions.map((page) => (
            <option key={page.href} value={page.href}>{page.label} — {page.href}</option>
          ))}
        </select>
      </label>

      <label className={`${labelClassName()} lg:col-span-3`}>
        Topic
        <select name="topic_id" defaultValue={selectedReferenceId(item, "topic")} className={fieldClassName("w-full")}>
          <option value="">اختار موضوع عند استخدام نوع Topic</option>
          {references.topics.map((topic) => (
            <option key={topic.id} value={topic.id}>{optionTitle(topic)}</option>
          ))}
        </select>
      </label>

      <label className={`${labelClassName()} lg:col-span-3`}>
        Category
        <select name="category_id" defaultValue={selectedReferenceId(item, "topic_category")} className={fieldClassName("w-full")}>
          <option value="">اختار تصنيف عند استخدام نوع Category</option>
          {references.categories.map((category) => (
            <option key={category.id} value={category.id}>{optionTitle(category)}</option>
          ))}
        </select>
      </label>

      <label className={`${labelClassName()} lg:col-span-3`}>
        Project
        <select name="project_id" defaultValue={selectedReferenceId(item, "project")} className={fieldClassName("w-full")}>
          <option value="">اختار مشروع عند استخدام نوع Project</option>
          {references.projects.map((project) => (
            <option key={project.id} value={project.id}>{optionTitle(project)}</option>
          ))}
        </select>
      </label>

      <label className={`${labelClassName()} lg:col-span-4`}>
        رابط يدوي / خارجي / Custom
        <input name="href" defaultValue={item?.href ?? ""} placeholder="/projects أو https://..." className={fieldClassName("w-full text-left dir-ltr")} />
      </label>

      <label className={`${labelClassName()} lg:col-span-2`}>
        Anchor
        <input name="anchor" defaultValue={item?.anchor ?? ""} placeholder="section-id" className={fieldClassName("w-full text-left dir-ltr")} />
      </label>

      <label className={`${labelClassName()} lg:col-span-1`}>
        الترتيب
        <input name="sort_order" type="number" defaultValue={item?.sort_order ?? 0} className={fieldClassName("w-full")} />
      </label>

      <input type="hidden" name="linked_id" value={item?.linked_id ?? ""} />

      <label className={`${labelClassName()} lg:col-span-2`}>
        Target
        <select name="target" defaultValue={item?.target ?? "_self"} className={fieldClassName("w-full")}>
          <option value="_self">نفس الصفحة</option>
          <option value="_blank">تبويب جديد</option>
        </select>
      </label>

      <label className={`${labelClassName()} lg:col-span-3`}>
        CSS Class
        <input name="css_class" defaultValue={item?.css_class ?? ""} placeholder="مثال: nav-item-featured" className={fieldClassName("w-full text-left dir-ltr")} />
      </label>

      <label className={`${labelClassName()} lg:col-span-2`}>
        Style Preset
        <select name="style_preset" defaultValue={item?.style_preset ?? "default"} className={fieldClassName("w-full")}>
          <option value="default">default</option>
          <option value="premium-dark">premium-dark</option>
          <option value="gold-card">gold-card</option>
          <option value="compact-list">compact-list</option>
          <option value="cinematic-hero">cinematic-hero</option>
          <option value="minimal">minimal</option>
        </select>
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-white/62 lg:col-span-2">
        <input type="checkbox" name="is_visible" defaultChecked={item?.is_visible ?? true} className="size-4 accent-[#D8B87A]" />
        ظاهر
      </label>

      <div className="flex items-end lg:col-span-1">
        <button type="submit" className="min-h-11 w-full rounded-2xl bg-[#D8B87A] px-4 text-sm font-semibold text-[#05070B] transition hover:bg-[#E6C985]">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function TreeItem({
  item,
  level = 0,
  allItems,
  menu,
  references,
}: {
  item: TreeMenuItem;
  level?: number;
  allItems: MenuItem[];
  menu: Menu;
  references: References;
}) {
  return (
    <details className="group/tree space-y-3" open>
      <summary className="list-none cursor-pointer">
        <div className="rounded-[24px] border border-white/10 bg-[#05070B]/42 p-4 transition hover:border-[#D8B87A]/22" style={{ marginRight: level * 22 }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-full border border-white/10 text-xs text-white/42 transition group-open/tree:rotate-90">‹</span>
                <span className="rounded-full border border-[#D8B87A]/22 bg-[#D8B87A]/10 px-3 py-1 text-xs font-semibold text-[#D8B87A]">{item.sort_order}</span>
                <h3 className="text-lg font-semibold text-white">{item.label}</h3>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/45">{getItemTypeLabel(item.item_type)}</span>
                <span className={item.is_visible ? "text-xs text-emerald-300" : "text-xs text-red-300"}>{item.is_visible ? "ظاهر" : "مخفي"}</span>
                {item.children.length ? <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/40">{item.children.length} فرعي</span> : null}
              </div>
              <p className="mt-2 truncate font-en text-xs text-white/38">{item.href || "#"}</p>
              {item.linked_type && item.linked_id ? <p className="mt-1 font-en text-xs text-emerald-300/70">DB: {item.linked_type} #{item.linked_id}</p> : null}
              {item.css_class ? <p className="mt-1 font-en text-xs text-[#D8B87A]/70">class: {item.css_class}</p> : null}
            </div>

            <AdminRowActions
              actions={[
                { label: item.is_visible ? "إخفاء" : "إظهار", action: toggleMenuItemVisibility, fields: { id: item.id, menu_id: menu.id, is_visible: item.is_visible ? "false" : "true" }, icon: item.is_visible ? EyeOffIcon : EyeIcon, tone: "green" },
                { label: "نسخ", action: duplicateMenuItem, fields: { id: item.id, menu_id: menu.id }, icon: CopyIcon, tone: "blue" },
                { label: "حذف", action: deleteMenuItem, fields: { id: item.id, menu_id: menu.id }, icon: TrashIcon, tone: "red" },
              ]}
            />
          </div>
        </div>
      </summary>

      <div className="mt-3 space-y-3" style={{ marginRight: level * 22 }}>
        <div className="flex flex-wrap gap-2">
          <details>
            <summary className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#D8B87A]/20 px-3 py-2 text-xs text-[#D8B87A] transition hover:bg-[#D8B87A]/10">
              <PencilIcon /> تعديل العنصر
            </summary>
            <div className="mt-4">
              <MenuItemForm menu={menu} parentItems={allItems} references={references} item={item} action={updateMenuItem} submitLabel="حفظ" />
            </div>
          </details>

          <details>
            <summary className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-sky-400/20 px-3 py-2 text-xs text-sky-300 transition hover:bg-sky-400/10">
              <PlusIcon /> إضافة عنصر فرعي
            </summary>
            <div className="mt-4">
              <MenuItemForm menu={menu} parentItems={allItems} references={references} defaultParentId={item.id} action={createMenuItem} submitLabel="إضافة" />
            </div>
          </details>
        </div>

        {item.children.map((child) => (
          <TreeItem key={child.id} item={child} level={level + 1} allItems={allItems} menu={menu} references={references} />
        ))}
      </div>
    </details>
  );
}

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ message?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const menuId = Number(id);
  if (!Number.isFinite(menuId)) notFound();

  const [menuResult, itemsResult, topicsResult, categoriesResult, projectsResult] = await Promise.all([
    getSupabaseAdmin().from("menus").select("id, name, slug, location, is_active").eq("id", menuId).maybeSingle(),
    getSupabaseAdmin().from("menu_items").select("*").eq("menu_id", menuId).order("sort_order", { ascending: true }),
    getSupabaseAdmin().from("topics").select("id, title, slug").order("published_at", { ascending: false }).limit(150),
    getSupabaseAdmin().from("topic_categories").select("id, name, slug").order("sort_order", { ascending: true }).limit(150),
    getSupabaseAdmin().from("projects").select("id, title, name, slug").limit(150),
  ]);

  if (!menuResult.data) notFound();

  const menu = menuResult.data as Menu;
  const items = (itemsResult.data ?? []) as MenuItem[];
  const tree = buildTree(items);
  const flatTree = flattenItems(tree);
  const databaseReady = Boolean(menu.is_active && items.some((item) => item.is_visible));
  const references: References = {
    topics: (topicsResult.data ?? []) as ReferenceOption[],
    categories: (categoriesResult.data ?? []) as ReferenceOption[],
    projects: (projectsResult.data ?? []) as ReferenceOption[],
  };

  return (
    <main className="space-y-8">
      <AdminPageHeader
        eyebrow="MENU BUILDER"
        title={`شجرة ${menu.name}`}
        description="إدارة عناصر القائمة كـ Tree واضح: Parent / Child، إظهار وإخفاء، نسخ، حذف، ربط بقاعدة البيانات، Class وStyle Preset. الترتيب حاليًا بالأرقام، وDrag & Drop يدخل بعد تثبيت المرحلة."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/pages-blocks/menus" className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/58 transition hover:border-[#D8B87A]/30 hover:text-[#D8B87A]">← الرجوع لكل القوائم</Link>
        <span className={databaseReady ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-300" : "rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-4 py-2 text-xs text-[#F4D99A]"}>
          {databaseReady ? "Database Ready" : "Fallback محتمل حتى تجهز الداتا"}
        </span>
      </div>

      {query?.message ? <div className="rounded-[22px] border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-5 py-4 text-sm text-[#F4D99A]">{query.message}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[0.45fr_1fr]">
        <aside className="space-y-6">
          <div className="rounded-[30px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
            <h3 className="text-xl font-semibold text-white">بيانات القائمة</h3>
            <form action={updateMenu} className="mt-5 grid gap-4">
              <input type="hidden" name="id" value={menu.id} />
              <label className={labelClassName()}>الاسم<input name="name" defaultValue={menu.name} className={fieldClassName("w-full")} /></label>
              <label className={labelClassName()}>Slug<input name="slug" defaultValue={menu.slug} className={fieldClassName("w-full text-left dir-ltr")} /></label>
              <label className={labelClassName()}>Location<select name="location" defaultValue={menu.location} className={fieldClassName("w-full")}><option value="main">Header / Main</option><option value="mobile">Mobile</option><option value="footer">Footer</option><option value="custom">Custom</option></select></label>
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-white/62"><input type="checkbox" name="is_active" defaultChecked={menu.is_active} className="size-4 accent-[#D8B87A]" />نشطة</label>
              <button className="min-h-11 rounded-2xl bg-[#D8B87A] px-4 text-sm font-semibold text-[#05070B] transition hover:bg-[#E6C985]">حفظ بيانات القائمة</button>
            </form>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
            <h3 className="text-xl font-semibold text-white">إضافة عنصر جديد</h3>
            <p className="mt-2 text-sm leading-7 text-white/42">العنصر الجديد يضاف داخل هذه القائمة فقط. يمكن جعله Parent أو ربطه بصفحة/موضوع/تصنيف/مشروع.</p>
            <div className="mt-5">
              <MenuItemForm menu={menu} parentItems={items} references={references} action={createMenuItem} submitLabel="إضافة" />
            </div>
          </div>
        </aside>

        <section className="rounded-[30px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">شجرة {menu.name}</h3>
              <p className="mt-2 text-sm text-white/45">الترتيب الحالي بالأرقام. افتح/اقفل أي Parent من السهم أو الكارت نفسه. Drag & Drop مرحلة لاحقة.</p>
            </div>
            <span className="rounded-full border border-[#D8B87A]/20 px-4 py-2 text-xs text-[#D8B87A]">{items.length} عنصر</span>
          </div>

          <div className="mt-6 space-y-3">
            {tree.length ? tree.map((item) => (
              <TreeItem key={item.id} item={item} allItems={items} menu={menu} references={references} />
            )) : (
              <div className="rounded-[24px] border border-dashed border-white/10 p-8 text-center text-sm text-white/45">القائمة فاضية. أضف أول عنصر من النموذج الجانبي.</div>
            )}
          </div>

          {flatTree.length ? (
            <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.018] p-5">
              <h4 className="font-semibold text-white">قراءة سريعة للترتيب</h4>
              <div className="mt-4 space-y-2">
                {flatTree.map(({ item, level }) => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm" style={{ marginRight: level * 18 }}>
                    <span className="text-white/72">{item.label}</span>
                    <span className="font-en text-xs text-[#D8B87A]">#{item.sort_order}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
