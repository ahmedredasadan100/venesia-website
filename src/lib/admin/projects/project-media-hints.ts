import type { ProjectMediaCollection } from "../../projects/types";

export type ProjectMediaCollectionHint = {
  collection: ProjectMediaCollection;
  labelAr: string;
  descriptionAr: string;
  constructionPhaseHint: string;
  suggestedLabels: string[];
};

export const PROJECT_MEDIA_COLLECTION_HINTS: ProjectMediaCollectionHint[] = [
  {
    collection: "overview",
    labelAr: "نظرة عامة",
    descriptionAr: "صور تعريفية للمشروع — واجهة، مدخل، أو لقطة عامة.",
    constructionPhaseHint: "مناسبة لمرحلة الإطلاق التسويقي أو بعد اكتمال الهيكل الخارجي.",
    suggestedLabels: ["واجهة المشروع", "مدخل رئيسي", "لقطة جوية", "صالة استقبال"],
  },
  {
    collection: "delivery_specs",
    labelAr: "مواصفات التسليم",
    descriptionAr: "صور توضح جودة التشطيبات والمواد.",
    constructionPhaseHint: "أفضل بعد مرحلة التشطيبات الداخلية أو عينات الوحدات.",
    suggestedLabels: ["تشطيب داخلي", "مطبخ نموذجي", "حمام نموذجي", "تفاصيل مواد"],
  },
  {
    collection: "gallery",
    labelAr: "معرض المشروع",
    descriptionAr: "ألبوم عام لمراحل البناء والتنفيذ.",
    constructionPhaseHint: "استخدمه لتوثيق الحفر، الهيكل، الواجهات، والتسليم.",
    suggestedLabels: ["مرحلة الحفر", "الهيكل الخرساني", "أعمال الواجهات", "تقدم التنفيذ"],
  },
];

export function getProjectMediaCollectionHint(collection: ProjectMediaCollection) {
  return PROJECT_MEDIA_COLLECTION_HINTS.find((item) => item.collection === collection);
}

export function countMediaByCollection(
  media: Array<{ collection: string }>,
): Record<ProjectMediaCollection, number> {
  return {
    overview: media.filter((item) => item.collection === "overview").length,
    delivery_specs: media.filter((item) => item.collection === "delivery_specs").length,
    gallery: media.filter((item) => item.collection === "gallery").length,
  };
}
