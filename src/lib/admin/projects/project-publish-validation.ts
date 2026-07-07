import type { PublishChecklistItem } from "../content-workflow/publish-checklist-types";
import { validateSlugFormat } from "../content-workflow/topic-publish-validation";
import type { ProjectCategory } from "../../../config/projects-data";

export type ProjectPublishInput = {
  arabicName: string;
  slug: string;
  locationLabel: string;
  mapArea: string;
  status: string;
  statusLabel: string;
  image: string;
  heroImage: string;
  shortDescription: string;
  seoTitle: string;
  seoDescription: string;
  type: ProjectCategory;
  progress: number;
  mediaCount: number;
  mediaWithoutLabel: number;
  floorPlanCount: number;
  deliverySpecCount: number;
  overviewTitle: string;
  deliverySpecsTitle: string;
};

export function getProjectLocationLabel(input: ProjectPublishInput) {
  return input.locationLabel.trim() || input.mapArea.trim();
}

export function getProjectPublishValidationError(input: ProjectPublishInput): string | null {
  if (!input.arabicName.trim()) return "اسم المشروع بالعربية مطلوب قبل النشر.";
  if (!input.slug.trim()) return "Slug المشروع مطلوب قبل النشر.";
  if (!validateSlugFormat(input.slug)) {
    return "الـ Slug لازم يكون إنجليزي صغير، أرقام، وشرطة بين الكلمات فقط.";
  }
  if (!getProjectLocationLabel(input)) return "موقع المشروع مطلوب قبل النشر.";
  if (!input.status.trim()) return "حالة المشروع مطلوبة قبل النشر.";
  if (!input.image.trim() && !input.heroImage.trim()) {
    return "صورة البطاقة أو صورة الهيرو مطلوبة قبل النشر.";
  }
  if (!input.shortDescription.trim() || input.shortDescription.trim().length < 20) {
    return "الوصف المختصر مطلوب ولا يقل عن 20 حرفًا قبل النشر.";
  }
  return null;
}

export function buildProjectPublishChecklist(input: ProjectPublishInput): PublishChecklistItem[] {
  const blockingError = getProjectPublishValidationError(input);
  const hasLocation = Boolean(getProjectLocationLabel(input));
  const hasImage = Boolean(input.image.trim() || input.heroImage.trim());
  const hasShortDescription = input.shortDescription.trim().length >= 20;

  const items: PublishChecklistItem[] = [
    {
      id: "arabic-name",
      label: "الاسم بالعربية",
      status: input.arabicName.trim() ? "pass" : "fail",
      hint: input.arabicName.trim() ? "الاسم موجود." : "أضف اسم المشروع بالعربية.",
    },
    {
      id: "slug",
      label: "Slug",
      status: !input.slug.trim() ? "fail" : validateSlugFormat(input.slug) ? "pass" : "fail",
      hint: validateSlugFormat(input.slug)
        ? `المسار العام: /projects/${input.slug}`
        : "استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط.",
    },
    {
      id: "location",
      label: "الموقع",
      status: hasLocation ? "pass" : "fail",
      hint: hasLocation ? "موقع أو منطقة الخريطة محددة." : "أضف Project Location أو Map Area.",
    },
    {
      id: "status",
      label: "حالة التنفيذ",
      status: input.status.trim() ? "pass" : "fail",
      hint: input.statusLabel.trim()
        ? `${input.status} — ${input.statusLabel}`
        : `الحالة الحالية: ${input.status || "غير محددة"}`,
    },
    {
      id: "hero-image",
      label: "صورة رئيسية / هيرو",
      status: hasImage ? "pass" : "fail",
      hint: hasImage
        ? "صورة البطاقة أو خلفية الهيرو متوفرة."
        : "أضف Project Image أو Hero Background.",
    },
    {
      id: "short-description",
      label: "وصف مختصر",
      status: hasShortDescription ? "pass" : "fail",
      hint: hasShortDescription
        ? `${input.shortDescription.trim().length} حرفًا.`
        : "الوصف المختصر مطلوب (20 حرفًا على الأقل).",
    },
    {
      id: "seo-title",
      label: "SEO Title",
      status: input.seoTitle.trim() ? "pass" : "warn",
      hint: input.seoTitle.trim() ? "عنوان SEO موجود." : "يُفضّل إضافة SEO Title قبل النشر.",
    },
    {
      id: "seo-description",
      label: "SEO Description",
      status: input.seoDescription.trim() ? "pass" : "warn",
      hint: input.seoDescription.trim()
        ? `${input.seoDescription.trim().length} حرفًا.`
        : "يُفضّل إضافة SEO Description قبل النشر.",
    },
    {
      id: "progress",
      label: "نسبة التقدم",
      status: input.progress > 0 ? "pass" : "info",
      hint:
        input.progress > 0
          ? `${input.progress}% — جاهزة لصفحة المتابعة لاحقًا.`
          : "لم تُضبط بعد — لا تظهر علنًا حاليًا لكنها ستُستخدم في Track Your Project.",
    },
    {
      id: "media-labels",
      label: "تسميات صور المشروع",
      status:
        input.mediaCount === 0
          ? "info"
          : input.mediaWithoutLabel === 0
            ? "pass"
            : "warn",
      hint:
        input.mediaCount === 0
          ? "لا توجد صور في المعرض بعد."
          : input.mediaWithoutLabel === 0
            ? "كل صور المشروع لها تسمية/وصف."
            : `${input.mediaWithoutLabel} صورة بدون تسمية — أضف Label لتحسين إمكانية الوصول.`,
    },
  ];

  if (input.type === "residential") {
    items.push(
      {
        id: "overview",
        label: "قسم النظرة العامة",
        status: input.overviewTitle.trim() ? "pass" : "warn",
        hint: input.overviewTitle.trim()
          ? "عنوان النظرة العامة موجود."
          : "يُفضّل إكمال عنوان النظرة العامة للمشاريع السكنية.",
      },
      {
        id: "delivery-specs",
        label: "مواصفات التنفيذ",
        status:
          input.deliverySpecsTitle.trim() && input.deliverySpecCount > 0
            ? "pass"
            : input.deliverySpecsTitle.trim() || input.deliverySpecCount > 0
              ? "warn"
              : "warn",
        hint:
          input.deliverySpecsTitle.trim() && input.deliverySpecCount > 0
            ? `${input.deliverySpecCount} بند مواصفات.`
            : "يُفضّل عنوان وبنود مواصفات التنفيذ للقالب السكني.",
      },
      {
        id: "floor-plans",
        label: "المخططات والمساحات",
        status: input.floorPlanCount > 0 ? "pass" : "warn",
        hint:
          input.floorPlanCount > 0
            ? `${input.floorPlanCount} مخططًا.`
            : "لا توجد مخططات — يُفضّل إضافتها للمشاريع السكنية.",
      },
    );
  }

  if (blockingError) {
    const firstFail = items.find((item) => item.status === "fail");
    if (!firstFail) {
      items.unshift({
        id: "blocking",
        label: "جاهزية النشر",
        status: "fail",
        hint: blockingError,
      });
    }
  }

  return items;
}

export function projectPublishInputFromBundle(bundle: {
  project: {
    arabic_name: string;
    slug: string;
    location_label: string;
    map_area: string;
    status: string;
    status_label: string;
    image: string;
    hero_image: string;
    short_description: string;
    seo_title: string | null;
    seo_description: string | null;
    type: ProjectCategory;
    progress: number;
    overview_title: string | null;
    delivery_specs_title: string | null;
  };
  media: Array<{ label: string }>;
  floorPlans: unknown[];
  deliverySpecItems: unknown[];
}): ProjectPublishInput {
  const mediaWithoutLabel = bundle.media.filter((item) => !item.label?.trim()).length;

  return {
    arabicName: bundle.project.arabic_name,
    slug: bundle.project.slug,
    locationLabel: bundle.project.location_label,
    mapArea: bundle.project.map_area,
    status: bundle.project.status,
    statusLabel: bundle.project.status_label,
    image: bundle.project.image,
    heroImage: bundle.project.hero_image,
    shortDescription: bundle.project.short_description,
    seoTitle: bundle.project.seo_title ?? "",
    seoDescription: bundle.project.seo_description ?? "",
    type: bundle.project.type,
    progress: bundle.project.progress ?? 0,
    mediaCount: bundle.media.length,
    mediaWithoutLabel,
    floorPlanCount: bundle.floorPlans.length,
    deliverySpecCount: bundle.deliverySpecItems.length,
    overviewTitle: bundle.project.overview_title ?? "",
    deliverySpecsTitle: bundle.project.delivery_specs_title ?? "",
  };
}
