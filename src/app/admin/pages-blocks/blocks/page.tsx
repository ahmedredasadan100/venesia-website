import Link from "next/link";
import { DEPRECATED_BLOCK_MODULE_CATALOG } from "../../../../lib/page-blocks/deprecated-block-modules";
import {
  AdminActionButton,
  AdminCard,
  AdminPageContextHeader,
  AdminStatusPill,
} from "../../../../components/admin/ui";

type BlockModule = {
  key: string;
  titleAr: string;
  href: string;
  status: "active" | "planned" | "deprecated";
  description: string;
  examples: string[];
};

const modules: BlockModule[] = [
  {
    key: "hero",
    titleAr: "الهيرو",
    href: "/admin/pages-blocks/blocks/hero",
    status: "active",
    description:
      "إدارة كل قوالب الهيرو كموديولات مستقلة قابلة للربط بأكثر من صفحة.",
    examples: ["Hero الرئيسية", "Hero من نحن", "Hero المركز الإعلامي"],
  },
  {
    key: "content",
    titleAr: "محتوى حر",
    href: "/admin/pages-blocks/blocks/content",
    status: "active",
    description:
      "بلوك محتوى منظم للمقدمات، النصوص، الرسائل التوعوية، أو أجزاء الصفحة الثابتة.",
    examples: ["مقدمة الصفحة", "رسالة مبدأ", "محتوى تعليمي"],
  },
  {
    key: "cta",
    titleAr: "دعوات الإجراء",
    href: "/admin/pages-blocks/blocks/cta",
    status: "active",
    description:
      "بلوكات الدعوة للإجراء التي تظهر داخل الصفحات أو قبل الفوتر.",
    examples: ["احجز استشارة", "تواصل معنا", "تابع التنفيذ"],
  },
  {
    key: "cards",
    titleAr: "الكروت",
    href: "/admin/pages-blocks/blocks/cards",
    status: "active",
    description:
      "مجموعات كروت عامة لأي محتوى متكرر: مزايا، خدمات، خطوات تنفيذ، أو روابط داخلية.",
    examples: ["مزايا المشروع", "خطوات التنفيذ", "خدمات فينيسيا"],
  },
  {
    key: "breadcrumb",
    titleAr: "مسار التنقل",
    href: "/admin/pages-blocks/blocks/breadcrumb",
    status: "active",
    description: "موديول مستقل لمسار التنقل داخل الصفحات — منفصل تمامًا عن Hero.",
    examples: ["من نحن", "مواضيع تهمك", "تواصل معنا"],
  },
  {
    key: "gallery",
    titleAr: "معرض الصور",
    href: "#",
    status: "planned",
    description:
      "بلوكات صور قابلة للربط بوسائط أو مشاريع أو مصادر يدوية، مع أنماط مختلفة للعرض.",
    examples: ["صور المشروع", "صور الموقع", "قبل وبعد"],
  },
  {
    key: "feed",
    titleAr: "خلاصة المحتوى",
    href: "/admin/pages-blocks/blocks/feed",
    status: "active",
    description:
      "موديول موضوعات يدعم أحدث الموضوعات والأكثر قراءة والتصنيفات والسلاسل، مع تعدد التصنيفات وفلترة السلسلة.",
    examples: ["أحدث الموضوعات", "الأكثر قراءة", "مواضيع تهمك", "سلاسل المحتوى"],
  },
  {
    key: "faq",
    titleAr: "الأسئلة الشائعة",
    href: "#",
    status: "planned",
    description:
      "مكتبة أسئلة قابلة لإعادة الاستخدام داخل الصفحات والمقالات والمشاريع، مع اختيار المصدر والظهور.",
    examples: ["أسئلة الشراء", "أسئلة الاستثمار", "أسئلة التسليم"],
  },
  ...DEPRECATED_BLOCK_MODULE_CATALOG.map((entry) => ({
    key: entry.key,
    titleAr: entry.titleAr,
    href: "#",
    status: "deprecated" as const,
    description: entry.description,
    examples: [`استُبدل بـ ${entry.replacedBy}`],
  })),
];

function ModuleCard({ module }: { module: BlockModule }) {
  const isActive = module.status === "active";
  const isDeprecated = module.status === "deprecated";

  const content = (
    <AdminCard interactive={isActive} className={`group h-full p-5 ${isDeprecated ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-white">{module.titleAr}</h2>
        </div>
        <AdminStatusPill tone={isActive ? "green" : isDeprecated ? "gold" : "muted"}>
          {isActive ? "نشط" : isDeprecated ? "متوقف" : "قريبًا"}
        </AdminStatusPill>
      </div>

      <p className="mt-4 min-h-[84px] text-sm leading-7 text-white/52">
        {module.description}
      </p>

      {module.examples.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {module.examples.map((example) => (
            <span
              key={example}
              className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs text-white/42"
            >
              {example}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#D8B87A]">
        {isActive ? "فتح الموديول" : isDeprecated ? "غير متاح — استخدم الهيرو" : "سيتم تفعيله لاحقًا"}
        {isActive ? <span aria-hidden="true">←</span> : null}
      </div>
    </AdminCard>
  );

  return isActive ? (
    <Link href={module.href} className="block h-full">
      {content}
    </Link>
  ) : (
    <div className="h-full">{content}</div>
  );
}

const visibleModules = modules.filter((module) => module.status !== "deprecated");
const deprecatedModules = modules.filter((module) => module.status === "deprecated");

export default function BlocksPage() {
  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <AdminPageContextHeader
        eyebrow="إدارة الصفحات والموديولات"
        title="البلوكات"
        description="مكتبة الموديولات القابلة لإعادة الاستخدام. تُدار القوالب هنا ثم تُربط بالصفحات من شاشة إدارة الصفحات."
        actions={
          <AdminActionButton href="/admin/pages-blocks/pages" variant="gold">
            فتح إدارة الصفحات
          </AdminActionButton>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleModules.map((module) => (
          <ModuleCard key={module.key} module={module} />
        ))}
      </section>

      {deprecatedModules.length ? (
        <section className="rounded-[28px] border border-amber-400/15 bg-amber-400/[0.04] p-5">
          <p className="text-sm font-semibold text-amber-100/90">موديولات متوقفة</p>
          <p className="mt-2 text-sm leading-7 text-white/50">
            هذه الموديولات لم تُنفَّذ backend لها أو استُبدلت بنظام أحدث. لا تظهر ضمن خيارات الإنشاء
            العادية.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {deprecatedModules.map((module) => (
              <ModuleCard key={module.key} module={module} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
