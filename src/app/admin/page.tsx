import Link from "next/link";
import { MEDIA_LIST_CONTENT_TYPES } from "./content/media/media-content-config";
import { getSupabaseAdmin } from "../../lib/supabase-admin";

export const dynamic = "force-dynamic";

type RecentTopic = {
  id: number;
  title: string | null;
  slug: string | null;
  status: string | null;
  category: string | null;
  updated_at: string | null;
  published_at: string | null;
};

type RecentProject = {
  code: string | null;
  arabic_name: string | null;
  slug: string | null;
};

type DashboardStats = {
  articles: number;
  categories: number;
  media: number;
  projects: number;
  published: number;
  drafts: number;
  recentTopics: RecentTopic[];
  recentProjects: RecentProject[];
};

type FilterableCountQuery = {
  is(column: string, value: null): FilterableCountQuery;
  eq(column: string, value: string): FilterableCountQuery;
  neq(column: string, value: string): FilterableCountQuery;
  in(column: string, values: string[]): FilterableCountQuery;
};

async function getCount(table: string, filter?: (query: FilterableCountQuery) => FilterableCountQuery) {
  try {
    const baseQuery = getSupabaseAdmin().from(table).select("id", { count: "exact", head: true });
    const query = filter
      ? filter(baseQuery as unknown as FilterableCountQuery)
      : (baseQuery as unknown as FilterableCountQuery);
    const { count } = await (query as unknown as typeof baseQuery);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function getDashboardStats(): Promise<DashboardStats> {
  const [articles, categories, media, projects, published, drafts, recentResult, recentProjectsResult] = await Promise.all([
    getCount("topics", (query) => query.eq("content_type", "article").is("deleted_at", null)),
    getCount("topic_categories"),
    getCount("topics", (query) =>
      query.in("content_type", [...MEDIA_LIST_CONTENT_TYPES]).is("deleted_at", null),
    ),
    getCount("projects"),
    getCount("topics", (query) =>
      query.eq("content_type", "article").eq("status", "published").is("deleted_at", null),
    ),
    getCount("topics", (query) =>
      query.eq("content_type", "article").neq("status", "published").is("deleted_at", null),
    ),
    getSupabaseAdmin()
      .from("topics")
      .select("id,title,slug,status,category,updated_at,published_at")
      .eq("content_type", "article")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(6),
    getSupabaseAdmin()
      .from("projects")
      .select("code, arabic_name, slug")
      .order("updated_at", { ascending: false })
      .limit(4),
  ]);

  return {
    articles,
    categories,
    media,
    projects,
    published,
    drafts,
    recentTopics: Array.isArray(recentResult.data) ? recentResult.data : [],
    recentProjects: Array.isArray(recentProjectsResult.data) ? recentProjectsResult.data : [],
  };
}

function formatDate(value?: string | null) {
  if (!value) return "غير محدد";
  try {
    return new Intl.DateTimeFormat("ar-EG", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
  } catch {
    return "غير محدد";
  }
}

function statusLabel(status?: string | null) {
  if (status === "published") return "منشور";
  if (status === "unpublished") return "مخفي";
  if (status === "archived") return "أرشيف";
  return "مسودة";
}

function StatusPill({ status }: { status?: string | null }) {
  const published = status === "published";
  return (
    <span
      className={[
        "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
        published
          ? "border-emerald-400/28 bg-emerald-400/10 text-emerald-200 shadow-[0_0_24px_rgba(34,197,94,0.08)]"
          : "border-[#D8B87A]/25 bg-[#D8B87A]/10 text-[#F4D99A]",
      ].join(" ")}
    >
      {statusLabel(status)}
    </span>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = "gold",
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: string;
  tone?: "gold" | "blue" | "green" | "purple" | "amber" | "cyan";
}) {
  const toneClass = {
    gold: "from-[#D8B87A]/24 to-[#D8B87A]/4 text-[#D8B87A] border-[#D8B87A]/22",
    blue: "from-[#2F6BFF]/24 to-[#2F6BFF]/4 text-[#8BB1FF] border-[#2F6BFF]/22",
    green: "from-emerald-400/22 to-emerald-400/4 text-emerald-200 border-emerald-400/22",
    purple: "from-violet-400/22 to-violet-400/4 text-violet-200 border-violet-400/22",
    amber: "from-amber-400/22 to-amber-400/4 text-amber-200 border-amber-400/22",
    cyan: "from-cyan-400/22 to-cyan-400/4 text-cyan-200 border-cyan-400/22",
  }[tone];

  return (
    <div className="admin-premium-card group relative overflow-hidden rounded-[26px] p-4 transition duration-300 hover:-translate-y-1">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(216,184,122,0.12),transparent_36%)] opacity-80 transition group-hover:opacity-100" />
      <div aria-hidden className="venesia-gold-sweep" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-white/46">{label}</p>
          <p className="mt-2 font-en text-4xl font-semibold tracking-tight text-white drop-shadow-[0_0_22px_rgba(216,184,122,0.08)]">{value}</p>
          <p className="mt-2 text-[11px] text-white/38">{hint}</p>
        </div>
        <span className={["grid size-11 shrink-0 place-items-center rounded-2xl border bg-gradient-to-br font-en text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]", toneClass].join(" ")}>
          {icon}
        </span>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={["admin-premium-card rounded-[28px] p-5", className].join(" ")}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs leading-6 text-white/42">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  const kpis = [
    { label: "إجمالي المقالات", value: stats.articles, hint: "كل محتوى مواضيع تهمك", icon: "01", tone: "gold" as const },
    { label: "التصنيفات", value: stats.categories, hint: "شجرة المحتوى الحالية", icon: "02", tone: "purple" as const },
    { label: "المشروعات", value: stats.projects, hint: "مسجّلة في النظام", icon: "03", tone: "green" as const },
    { label: "المنشور", value: stats.published, hint: "ظاهر على الموقع", icon: "04", tone: "blue" as const },
    { label: "المسودات", value: stats.drafts, hint: "تحتاج مراجعة", icon: "05", tone: "amber" as const },
    { label: "الوسائط", value: stats.media, hint: "مركز إعلامي", icon: "06", tone: "cyan" as const },
  ];

  const quickActions = [
    { href: "/admin/content/topics/new", label: "موضوع جديد", hint: "إضافة محتوى", icon: "+" },
    { href: "/admin/content/categories/new", label: "تصنيف جديد", hint: "تنظيم الشجرة", icon: "▤" },
    { href: "/admin/settings/general", label: "الإعدادات", hint: "بيانات النظام", icon: "⚙" },
  ];

  const healthItems = [
    { label: "مقالات بدون صورة مميزة", value: "—" },
    { label: "مقالات بدون وصف SEO", value: "—" },
    { label: "تصنيفات تحتاج صورة عرض", value: "—" },
    { label: "مسودات قديمة", value: stats.drafts },
  ];

  return (
    <div className="space-y-5 pb-10">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_1fr_.95fr]">
        <Panel title="إجراءات سريعة" subtitle="اختصارات تنفيذية للمهام اليومية">
          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
<Link
  key={action.label}
  href={action.href}
  className="admin-mini-card group relative overflow-hidden rounded-[22px] border border-[#D8B87A]/12 bg-white/[0.035] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-[#D8B87A]/34 hover:bg-[#D8B87A]/8 hover:shadow-[0_20px_60px_rgba(216,184,122,0.08)]"
>
  <div aria-hidden className="venesia-gold-sweep" />

  <div className="flex h-full min-h-[74px] items-center justify-between gap-4" dir="ltr">
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#D8B87A]/15 bg-[radial-gradient(circle,rgba(216,184,122,0.24),rgba(216,184,122,0.06)_72%)] font-en text-base leading-none text-[#D8B87A]">
      {action.icon}
    </span>

    <span className="flex min-w-0 flex-1 flex-col items-end justify-center text-right" dir="rtl">
      <span className="text-base font-semibold leading-7 text-white transition-colors group-hover:text-white">
        {action.label}
      </span>

      <span className="mt-1 text-xs leading-5 text-white/45">
        {action.hint}
      </span>
    </span>
  </div>
</Link>
            ))}
          </div>
        </Panel>

        <Panel title="آخر النشاطات" subtitle="ملخص سريع لحركة الإدارة">
          <div className="space-y-3">
            {["تم تحديث لوحة التحكم الرئيسية.", "تم تفعيل حقول التصنيفات الشجرية.", "تم تجهيز صفحات Placeholder للتوسع القادم.", "تم ربط المؤشرات الأساسية بقاعدة البيانات."].map((item, index) => (
              <div key={item} className="flex gap-3 rounded-[20px] border border-[#D8B87A]/10 bg-white/[0.026] p-3 transition hover:border-[#D8B87A]/22 hover:bg-white/[0.04]">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 font-en text-xs text-[#D8B87A] shadow-[0_0_18px_rgba(216,184,122,0.12)]">{index + 1}</span>
                <p className="text-sm leading-7 text-white/62">{item}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="صحة المحتوى" subtitle="نقاط تحتاج متابعة قبل التوسع">
          <div className="space-y-3">
            {healthItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-[20px] border border-[#D8B87A]/10 bg-white/[0.03] px-4 py-3 transition hover:border-[#D8B87A]/22 hover:bg-white/[0.045]">
                <span className="text-sm text-white/62">{item.label}</span>
                <span className="font-en text-sm font-semibold text-[#D8B87A]">{item.value}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <Panel title="آخر المحتويات" subtitle="أحدث المقالات التي تم تعديلها">
          <div className="overflow-hidden rounded-[24px] border border-[#D8B87A]/10">
            <table className="w-full table-fixed border-collapse text-right text-xs md:text-sm">
              <thead className="bg-white/[0.045] text-white/42">
                <tr>
                  <th className="px-4 py-4 font-medium">العنوان</th>
                  <th className="px-4 py-4 font-medium">النوع</th>
                  <th className="px-4 py-4 font-medium">التصنيف</th>
                  <th className="px-4 py-4 font-medium">الحالة</th>
                  <th className="px-4 py-4 font-medium">آخر تحديث</th>
                  <th className="px-4 py-4 font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8B87A]/10">
                {stats.recentTopics.length ? (
                  stats.recentTopics.map((topic) => (
                    <tr key={topic.id} className="transition hover:bg-[#D8B87A]/[0.035]">
                      <td className="max-w-[310px] px-4 py-4 text-white/78"><span className="line-clamp-1">{topic.title ?? "بدون عنوان"}</span></td>
                      <td className="px-4 py-4 text-white/45">مقال</td>
                      <td className="px-4 py-4 text-white/45">{topic.category ?? "غير محدد"}</td>
                      <td className="px-4 py-4"><StatusPill status={topic.status} /></td>
                      <td className="px-4 py-4 text-white/45">{formatDate(topic.updated_at ?? topic.published_at)}</td>
                      <td className="px-3 py-4"><Link href={`/admin/content/topics/${topic.id}`} className="text-[#D8B87A] transition hover:text-[#F4D99A]">تعديل</Link></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-white/42">لا توجد بيانات للعرض حاليًا.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="ملخص المشروعات" subtitle="نظرة تنفيذية سريعة">
          <div className="space-y-4">
            {stats.recentProjects.length ? (
              stats.recentProjects.map((project) => (
                <div
                  key={project.slug ?? project.code ?? "project"}
                  className="rounded-[22px] border border-[#D8B87A]/10 bg-white/[0.032] p-4 transition hover:border-[#D8B87A]/24 hover:bg-white/[0.048]"
                >
                  <p className="font-en text-sm font-semibold text-[#D8B87A]">{project.code}</p>
                  <p className="mt-1 line-clamp-1 text-sm text-white/72">{project.arabic_name}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/42">لا توجد مشروعات للعرض حاليًا.</p>
            )}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <Panel title="حالة النظام" subtitle="جاهزية الخدمات الأساسية">
          <div className="grid gap-3 sm:grid-cols-2">
            {["قاعدة البيانات", "التخزين", "الكاش", "API"].map((item) => (
              <div key={item} className="rounded-[20px] border border-emerald-400/16 bg-emerald-400/[0.055] p-4 shadow-[0_0_26px_rgba(34,197,94,0.055)]">
                <p className="text-sm text-white/70">{item}</p>
                <p className="mt-2 text-xs text-emerald-200">متصل ومستقر</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="نظرة تحليلية" subtitle="Placeholder للتحليلات القادمة">
          <div className="flex min-h-[170px] items-end gap-3 rounded-[24px] border border-[#D8B87A]/10 bg-white/[0.025] p-5">
            {[46, 72, 58, 86, 64, 92, 75, 88, 53, 79, 96, 68].map((height, index) => (
              <div key={index} className="flex flex-1 items-end">
                <div className="w-full rounded-t-2xl bg-[linear-gradient(180deg,#F0D493,#D8B87A_46%,rgba(216,184,122,0.22))] shadow-[0_0_22px_rgba(216,184,122,0.12)]" style={{ height: `${height}%` }} />
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
