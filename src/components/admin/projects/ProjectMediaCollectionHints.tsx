import {
  countMediaByCollection,
  PROJECT_MEDIA_COLLECTION_HINTS,
} from "../../../lib/admin/projects/project-media-hints";
import type { ProjectMediaRow } from "../../../lib/projects/types";

type ProjectMediaCollectionHintsProps = {
  media: ProjectMediaRow[];
};

export default function ProjectMediaCollectionHints({ media }: ProjectMediaCollectionHintsProps) {
  const counts = countMediaByCollection(media);

  return (
    <section className="rounded-[24px] border border-[#D8B87A]/12 bg-[#080B10]/88 p-5">
      <p className="font-en text-[11px] tracking-[0.28em] text-[#D8B87A]/70">PROJECT MEDIA PHASES</p>
      <h3 className="mt-2 text-lg font-semibold text-white">تلميحات وسائط المشروع</h3>
      <p className="mt-2 text-sm text-white/45">
        استخدم مجموعات الصور الحالية (overview / delivery_specs / gallery) لتنظيم مراحل البناء — بدون أعمدة
        جديدة.
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {PROJECT_MEDIA_COLLECTION_HINTS.map((hint) => (
          <article
            key={hint.collection}
            className="rounded-[18px] border border-white/8 bg-black/20 px-4 py-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{hint.labelAr}</p>
              <span className="rounded-full border border-white/10 px-2 py-0.5 font-en text-[10px] text-white/40">
                {hint.collection}
              </span>
            </div>
            <p className="mt-2 text-xs leading-6 text-white/48">{hint.descriptionAr}</p>
            <p className="mt-3 text-xs leading-6 text-[#D8B87A]/75">{hint.constructionPhaseHint}</p>
            <p className="mt-3 text-[11px] text-white/35">
              {counts[hint.collection]} صورة حاليًا
              {counts[hint.collection] > 0 ? "" : " — فارغ"}
            </p>
            <p className="mt-2 text-[10px] leading-5 text-white/30">
              أمثلة Label: {hint.suggestedLabels.join(" · ")}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
