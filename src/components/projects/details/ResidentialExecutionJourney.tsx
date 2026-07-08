"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";

import { type ResidentialExecutionJourneyStage } from "../../../lib/projects/public-types";

type ResidentialExecutionJourneyProps = {
  stages?: ResidentialExecutionJourneyStage[];
};

export default function ResidentialExecutionJourney({
  stages,
}: ResidentialExecutionJourneyProps) {
  const safeStages = stages ?? [];

  const [activeStageId, setActiveStageId] = useState(
    safeStages[0]?.id ?? ""
  );
  const [activeUpdateId, setActiveUpdateId] = useState("");

  const activeStage =
    safeStages.find((stage) => stage.id === activeStageId) ?? safeStages[0];

  const safeUpdates = activeStage?.updates ?? [];

  const resolvedUpdateId = safeUpdates.some((update) => update.id === activeUpdateId)
    ? activeUpdateId
    : (safeUpdates[0]?.id ?? "");

  if (!safeStages.length || !activeStage) return null;

  const activeUpdate =
    safeUpdates.find((update) => update.id === resolvedUpdateId) ?? safeUpdates[0];

  const galleryImages = (activeUpdate?.gallery?.length
    ? activeUpdate.gallery
    : [activeStage.image]
  ).slice(0, 3);

  return (
    <section id="execution" className="scroll-mt-24 px-4 py-10 sm:px-6" dir="rtl">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-7 text-center">
          <p className="font-en text-[11px] uppercase tracking-[0.28em] text-[#D8B87A]/65">
            Construction journey
          </p>

          <h2 className="mt-2 text-3xl font-semibold text-[#D8B87A] md:text-[34px]">
            رحلة التنفيذ
          </h2>

          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-white/50">
            متابعة دقيقة لكل مرحلة من مراحل التنفيذ، من المخطط إلى واقع موثّق على الأرض.
          </p>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-[#D8B87A]/18 bg-[#070A0F] shadow-[0_22px_70px_rgba(0,0,0,0.34)]">
          <div className="grid h-[225px] lg:grid-cols-[0.34fr_0.66fr]">
            <aside className="relative z-10 flex h-[225px] flex-col items-center justify-center border-b border-[#D8B87A]/14 bg-[#070A0F] px-5 py-4 text-center lg:border-b-0 lg:border-l">
              <p className="text-xs text-white/44">نسبة الإنجاز</p>

              <p className="mt-1 font-en text-[38px] font-semibold leading-none text-[#D8B87A] md:text-[46px]">
                {activeStage.progress}%
              </p>

              <h3 className="mt-2 text-lg font-semibold text-white md:text-xl">
                {activeStage.title}
              </h3>

              <p className="mt-2 max-w-xs text-xs leading-5 text-white/58">
                {activeStage.summary}
              </p>

              <div className="mt-2 flex items-center justify-center gap-2 border-t border-white/10 pt-2 text-xs text-white/42">
                <CalendarIcon />
                <span>
                  آخر تحديث: <span className="text-white/68">{activeStage.lastUpdated}</span>
                </span>
              </div>
            </aside>

            <div className="relative h-[225px] overflow-hidden">
              <Image
                src={activeStage.image}
                alt={activeStage.title}
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
              />

              <div className="absolute inset-0 bg-[linear-gradient(to_left,rgba(5,7,11,0.16),rgba(5,7,11,0.18),rgba(5,7,11,0.82))]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_70%_20%,rgba(216,184,122,0.16),transparent_58%)]" />

              <div className="absolute bottom-4 right-5 text-right">
                <p className="text-xs text-white/55">المرحلة الحالية</p>
                <h3 className="mt-1 text-xl font-semibold text-white">
                  {activeStage.title}
                </h3>
              </div>
            </div>
          </div>

          <div className="border-t border-[#D8B87A]/14 px-5 py-5">
            <div className="relative">
              <div className="absolute left-0 right-0 top-[27px] h-px bg-[#D8B87A]/30" />

              <div className="relative grid gap-4 md:grid-cols-5">
                {safeStages.map((stage) => {
                  const isActive = stage.id === activeStage.id;

                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => setActiveStageId(stage.id)}
                      className="group relative flex cursor-pointer flex-col items-center text-center"
                    >
                      <span className="mb-2 text-xs font-semibold text-[#D8B87A]">
                        {stage.progress}%
                      </span>

                      <span
                        className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border transition ${
                          isActive
                            ? "border-[#D8B87A] bg-[#D8B87A]/16 text-[#D8B87A] shadow-[0_0_26px_rgba(216,184,122,0.45)]"
                            : "border-[#D8B87A]/38 bg-[#05070B] text-[#D8B87A]/68 group-hover:border-[#D8B87A]"
                        }`}
                      >
                        <StageIcon />
                      </span>

                      <span
                        className={`mt-2 text-xs transition ${
                          isActive ? "text-[#D8B87A]" : "text-white/56"
                        }`}
                      >
                        {stage.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-0 border-t border-[#D8B87A]/14 lg:grid-cols-[0.31fr_0.38fr_0.31fr]">
            <div className="p-4">
              <InnerCard title="سجل التنفيذ">
                {safeUpdates.length ? (
                  <div className="space-y-2">
                    {safeUpdates.map((update) => {
                      const isActive = update.id === activeUpdate?.id;

                      return (
                        <button
                          key={update.id}
                          type="button"
                          onClick={() => setActiveUpdateId(update.id)}
                          onMouseEnter={() => setActiveUpdateId(update.id)}
                          className={`group flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-right transition ${
                            isActive
                              ? "border-[#D8B87A]/55 bg-[#D8B87A]/10"
                              : "border-white/10 bg-black/10 hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/5"
                          }`}
                        >
                          <div>
                            <p
                              className={`text-sm font-medium transition ${
                                isActive ? "text-[#D8B87A]" : "text-white/72"
                              }`}
                            >
                              {update.title}
                            </p>

                            <p className="mt-1 text-xs text-white/38">
                              {update.date}
                            </p>
                          </div>

                          <span
                            className={`font-en text-sm font-semibold ${
                              isActive ? "text-[#D8B87A]" : "text-white/45"
                            }`}
                          >
                            {update.progress}%
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-sm leading-6 text-white/45">
                    سيتم إضافة تفاصيل هذه المرحلة فور بدء التنفيذ.
                  </p>
                )}
              </InnerCard>
            </div>

            <div className="border-y border-[#D8B87A]/14 p-4 lg:border-x lg:border-y-0">
              <InnerCard title="صور المرحلة">
                <div className="grid grid-cols-3 gap-3">
                  {galleryImages.map((image, index) => (
                    <div
                      key={`${image}-${index}`}
                      className={`mx-auto w-[78%] overflow-hidden rounded-2xl border bg-black/25 ${
                        index === 0 ? "border-[#D8B87A]" : "border-white/10"
                      }`}
                    >
                      <Image
                        src={image}
                        alt={activeUpdate?.title ?? activeStage.title}
                        width={240}
                        height={192}
                        className="h-48 w-full object-cover transition duration-700 hover:scale-105"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex justify-center gap-2">
                  {galleryImages.map((_, dot) => (
                    <span
                      key={dot}
                      className={`h-1.5 rounded-full ${
                        dot === 0 ? "w-7 bg-[#D8B87A]" : "w-1.5 bg-white/18"
                      }`}
                    />
                  ))}
                </div>
              </InnerCard>
            </div>

            <div className="p-4">
              <InnerCard title="عن هذه المرحلة">
                <p className="text-center text-xs text-[#D8B87A]/70">
                  {activeUpdate?.title ?? activeStage.title}
                </p>

                <p className="mt-3 min-h-[70px] text-center text-sm leading-6 text-white/60">
                  {activeUpdate?.description ?? activeStage.summary}
                </p>

                <div className="mt-4 flex items-center justify-center gap-4 border-t border-white/10 pt-3 text-xs text-white/45">
                  <span>آخر تحديث</span>
                  <span className="text-white/70">
                    {activeUpdate?.date ?? activeStage.lastUpdated}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D8B87A]/35 px-4 py-2.5 text-sm text-[#D8B87A] transition hover:bg-[#D8B87A] hover:text-[#111]">
                    <PlayIcon />
                    مشاهدة فيديو
                  </button>

                  <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D8B87A]/35 px-4 py-2.5 text-sm text-[#D8B87A] transition hover:bg-[#D8B87A] hover:text-[#111]">
                    <ImageIcon />
                    عرض الصور
                  </button>
                </div>
              </InnerCard>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InnerCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="h-full rounded-[18px] border border-white/10 bg-white/[0.025] p-4">
      <p className="mb-3 text-center text-sm font-semibold text-[#D8B87A]">
        {title}
      </p>
      {children}
    </div>
  );
}

function StageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19V9l7-4 7 4v10" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 19v-6h6v6M9 10h2M13 10h2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 4v3M17 4v3M5 9h14" stroke="currentColor" strokeWidth="1.7" />
      <rect x="5" y="5" width="14" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10 8l6 4-6 4V8Z" fill="currentColor" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 15l3-3 3 3 2-2 3 3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="9" r="1.4" fill="currentColor" />
    </svg>
  );
}
