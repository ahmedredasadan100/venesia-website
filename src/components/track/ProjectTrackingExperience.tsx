"use client";

import Link from "next/link";
import { useState } from "react";

import PublicMediaImage from "../public/PublicMediaImage";
import Pagination from "../Pagination";
import {
  projectTrackingStatusLabel,
  type ProjectTrackingMedia,
  type ProjectTrackingPublicDetail,
  type ProjectTrackingStage,
  type ProjectTrackingUpdate,
} from "../../lib/projects/tracking/contract";

type ProjectTrackingExperienceProps = {
  detail: ProjectTrackingPublicDetail;
};

const statusClasses = {
  completed: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  in_progress: "border-amber-400/35 bg-amber-400/10 text-amber-300",
  not_started: "border-white/15 bg-white/[0.04] text-white/55",
} as const;

const statusTextClasses = {
  completed: "text-emerald-300",
  in_progress: "text-[#E2B45C]",
  not_started: "text-white/45",
} as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function durationLabel(stage: ProjectTrackingStage) {
  if (!stage.plannedDuration) return "—";
  const labels = { day: "يوم", week: "أسبوع", month: "شهر" } as const;
  return `${stage.plannedDuration.value} ${labels[stage.plannedDuration.unit]}`;
}

function statusDot(status: ProjectTrackingStage["status"]) {
  return status === "completed" ? "✓" : status === "in_progress" ? "◉" : "○";
}

function stagePresentationLabel(stage: ProjectTrackingStage, index: number) {
  const name = stage.name.trim();
  return /^(?:ال)?مرحلة\s+[٠-٩0-9]+(?:\s*[—-]|$)/u.test(name)
    ? name
    : `المرحلة ${index + 1} — ${name}`;
}

function playableVideo(media: ProjectTrackingMedia) {
  return /\.(mp4|webm|ogg)(?:\?.*)?$/i.test(media.url);
}

function MediaViewer({ media }: { media: ProjectTrackingMedia[] }) {
  const [active, setActive] = useState(0);
  const [windowStart, setWindowStart] = useState(0);
  const selected = media[active] ?? null;
  const visible = media.slice(windowStart, windowStart + 4);

  if (!selected) {
    return (
      <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-white/15 bg-black/25 px-6 text-center text-sm leading-7 text-white/45">
        لا توجد صور أو فيديوهات منشورة لهذا التحديث بعد.
      </div>
    );
  }

  return (
    <div className="space-y-3" data-tracking-media-viewer>
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-[#D8A84E]/25 bg-black">
        {selected.kind === "image" ||
        (!playableVideo(selected) && selected.posterUrl) ? (
          <PublicMediaImage
            src={selected.kind === "image" ? selected.url : selected.posterUrl!}
            alt={selected.title ?? "توثيق تنفيذ المشروع"}
            fill
            sizes="(max-width: 900px) 100vw, 52vw"
            className="object-cover"
          />
        ) : playableVideo(selected) ? (
          <video
            key={selected.url}
            controls
            preload="metadata"
            poster={selected.posterUrl ?? undefined}
            className="h-full w-full object-cover"
            aria-label={selected.title ?? "فيديو تحديث التنفيذ"}
          >
            <source src={selected.url} />
          </video>
        ) : (
          <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_center,rgba(216,168,78,.16),transparent_58%)] px-8 text-center">
            <div>
              <span
                className="mx-auto grid size-16 place-items-center rounded-full border border-[#D8A84E]/45 bg-black/45 text-2xl text-[#E2B45C]"
                aria-hidden
              >
                ▶
              </span>
              <p className="mt-4 text-sm text-white/60">
                {selected.title ?? "فيديو تحديث التنفيذ"}
              </p>
            </div>
          </div>
        )}
        {selected.kind === "video" && !playableVideo(selected) ? (
          <a
            href={selected.url}
            target="_blank"
            rel="noreferrer"
            className="absolute inset-x-4 bottom-4 rounded-xl border border-[#D8A84E]/50 bg-black/85 px-4 py-3 text-center text-sm font-semibold text-[#E2B45C] backdrop-blur"
          >
            مشاهدة الفيديو في نافذة جديدة ↗
          </a>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="الوسائط السابقة"
          disabled={windowStart === 0}
          onClick={() => setWindowStart((value) => Math.max(0, value - 4))}
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 text-white/70 disabled:opacity-25"
        >
          ›
        </button>
        <div className="grid min-w-0 flex-1 grid-cols-4 gap-2">
          {visible.map((entry, index) => {
            const absoluteIndex = windowStart + index;
            return (
              <button
                key={entry.id}
                type="button"
                aria-label={`عرض ${entry.title ?? `الوسيط ${absoluteIndex + 1}`}`}
                aria-pressed={active === absoluteIndex}
                onClick={() => setActive(absoluteIndex)}
                className={`relative aspect-[4/3] overflow-hidden rounded-xl border ${active === absoluteIndex ? "border-[#D8A84E] ring-2 ring-[#D8A84E]/20" : "border-white/10"}`}
              >
                {entry.kind === "image" || entry.posterUrl ? (
                  <PublicMediaImage
                    src={entry.kind === "image" ? entry.url : entry.posterUrl!}
                    alt=""
                    fill
                    sizes="150px"
                    className="object-cover"
                  />
                ) : (
                  <span
                    className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(216,168,78,.2),transparent_65%)]"
                    aria-hidden
                  />
                )}
                {entry.kind === "video" ? (
                  <span
                    className="absolute inset-0 grid place-items-center bg-black/25 text-xl"
                    aria-hidden
                  >
                    ▶
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="الوسائط التالية"
          disabled={windowStart + 4 >= media.length}
          onClick={() =>
            setWindowStart((value) =>
              Math.min(Math.max(0, media.length - 4), value + 4),
            )
          }
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 text-white/70 disabled:opacity-25"
        >
          ‹
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-4 text-center">
      <span className="h-px w-12 bg-gradient-to-l from-[#D8A84E] to-transparent" />
      <h2 className="text-xl font-semibold text-[#E2B45C] md:text-2xl">
        {children}
      </h2>
      <span className="h-px w-12 bg-gradient-to-r from-[#D8A84E] to-transparent" />
    </div>
  );
}

function TrackingEmptyState({ projectName }: { projectName: string }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 text-center md:px-8">
      <div className="rounded-[28px] border border-[#D8A84E]/20 bg-white/[0.025] px-6 py-16 shadow-2xl">
        <div className="mx-auto grid size-16 place-items-center rounded-full border border-[#D8A84E]/35 bg-[#D8A84E]/10 text-2xl text-[#E2B45C]">
          ⌁
        </div>
        <h2 className="mt-6 text-2xl font-semibold text-white">
          رحلة التنفيذ قيد التجهيز
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-8 text-white/55">
          مشروع {projectName} منشور، ولم تُنشر مراحل أو تحديثات تنفيذ له بعد.
          ستظهر الرحلة هنا فور اعتماد أول مرحلة مرئية.
        </p>
        <Link
          href="/projects"
          className="mt-7 inline-flex rounded-xl border border-[#D8A84E]/45 px-6 py-3 text-sm font-semibold text-[#E2B45C] hover:bg-[#D8A84E]/10"
        >
          العودة إلى جميع المشروعات
        </Link>
      </div>
    </section>
  );
}

export function ProjectTrackingUnavailableState({
  projectName,
}: {
  projectName: string;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-5xl items-center px-4 py-20 md:px-8">
      <section
        role="status"
        className="w-full rounded-[28px] border border-[#D8A84E]/20 bg-white/[0.025] px-6 py-16 text-center shadow-2xl"
      >
        <div className="mx-auto grid size-16 place-items-center rounded-full border border-[#D8A84E]/35 bg-[#D8A84E]/10 text-2xl text-[#E2B45C]">
          ⌁
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">
          Project Tracking
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">
          متابعة التنفيذ غير متاحة مؤقتًا
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-8 text-white/55">
          تعذر الوصول إلى بيانات متابعة مشروع {projectName} في الوقت الحالي. لم يتم
          اعتبار المشروع غير موجود، ويمكنك العودة لاحقًا بعد استعادة الخدمة.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/projects"
            className="inline-flex rounded-xl border border-[#D8A84E]/45 px-6 py-3 text-sm font-semibold text-[#E2B45C] hover:bg-[#D8A84E]/10"
          >
            العودة إلى جميع المشروعات
          </Link>
          <Link
            href="/contact"
            className="inline-flex rounded-xl bg-[#D8A84E] px-6 py-3 text-sm font-semibold text-[#161009] hover:bg-[#E2B45C]"
          >
            تواصل معنا
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function ProjectTrackingExperience({
  detail,
}: ProjectTrackingExperienceProps) {
  const currentStage = detail.currentStage;
  const activeStage =
    detail.stages.find((stage) => stage.id === detail.selectedStageId) ??
    detail.stages[0] ??
    null;
  const activeItem =
    activeStage?.items.find((item) => item.id === detail.selectedItemId) ??
    activeStage?.items[0] ??
    null;
  const activeUpdate =
    activeItem?.updates.find(
      (update) => update.id === detail.selectedUpdateId,
    ) ??
    activeItem?.updates[0] ??
    null;
  const basePath = `/track-your-project/${detail.project.slug}`;
  const selectionQuery = {
    stage: detail.selectedStageId ?? undefined,
    item: detail.selectedItemId ?? undefined,
    update: detail.selectedUpdateId ?? undefined,
    stagePage: detail.pagination.stages.page,
    itemPage: detail.pagination.items.page,
    updatePage: detail.pagination.updates.page,
    mediaPage: detail.pagination.media.page,
    historyPage: detail.pagination.history.page,
  };

  const heroImage = detail.latestVisual ?? detail.project.heroImage;
  const latestDate = detail.latestUpdate?.occurredAt;
  const locationLabel = detail.project.location?.trim() || null;

  return (
    <main
      className="min-h-screen overflow-hidden bg-[#07090B] text-white"
      dir="rtl"
      data-project-tracking-detail
    >
      <section className="relative border-b border-[#D8A84E]/20">
        {heroImage ? (
          <PublicMediaImage
            src={heroImage}
            alt={detail.project.heroImageAlt ?? detail.project.arabicName}
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-50"
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,9,11,.98)_0%,rgba(7,9,11,.68)_42%,rgba(7,9,11,.26)_72%,rgba(7,9,11,.9)_100%)]" />
        <div className="relative mx-auto grid min-h-[470px] max-w-7xl items-center gap-8 px-4 py-20 md:px-8 lg:grid-cols-[1fr_310px]">
          <div>
            <p
              className="font-en text-5xl text-[#E2B45C] md:text-7xl"
              dir="ltr"
            >
              {detail.project.code ?? detail.project.slug}
            </p>
            <h1 className="mt-3 text-3xl font-semibold md:text-5xl">
              {detail.project.arabicName}
            </h1>
            {locationLabel ? (
              <p className="mt-4 text-base text-white/72">
                ⌖ {locationLabel}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              {currentStage ? (
                <span
                  className={`rounded-lg border px-4 py-2 ${statusClasses[currentStage.status]}`}
                >
                  {projectTrackingStatusLabel(currentStage.status)}
                </span>
              ) : null}
              {currentStage ? (
                <span className="rounded-lg border border-white/10 bg-black/45 px-4 py-2 text-white/70">
                  المرحلة الحالية:{" "}
                  <b className="text-[#E2B45C]">{currentStage.name}</b>
                </span>
              ) : null}
              {latestDate ? (
                <span className="rounded-lg border border-white/10 bg-black/45 px-4 py-2 text-white/70">
                  آخر تحديث: {formatDate(latestDate)}
                </span>
              ) : null}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#updates"
                className="rounded-xl bg-[#D8A84E] px-6 py-3 text-sm font-bold text-black hover:bg-[#E2B45C]"
              >
                عرض كل التحديثات
              </a>
              <Link
                href="/contact"
                className="rounded-xl border border-[#D8A84E]/55 bg-black/35 px-6 py-3 text-sm font-semibold text-white hover:bg-[#D8A84E]/10"
              >
                طلب استفسار
              </Link>
            </div>
          </div>
          <aside className="rounded-2xl border border-[#D8A84E]/30 bg-black/65 p-5 backdrop-blur-md">
            <h2 className="text-base font-semibold text-[#E2B45C]">
              ملخص المشروع
            </h2>
            <dl className="mt-4 divide-y divide-white/10 text-sm">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-white/45">نوع المشروع</dt>
                <dd>
                  {detail.project.type === "commercial" ? "تجاري" : "سكني"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-white/45">تحديثات منشورة</dt>
                <dd>{detail.counts.updates}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-white/45">الصور</dt>
                <dd>{detail.counts.images}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-white/45">الفيديوهات</dt>
                <dd>{detail.counts.videos}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-white/45">المراحل المكتملة</dt>
                <dd>
                  {detail.counts.completedStages} من {detail.counts.stages}
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      {!detail.stages.length ? (
        <TrackingEmptyState projectName={detail.project.arabicName} />
      ) : (
        <>
          {activeStage ? (
            <section
              className="border-b border-white/10 px-4 py-10 md:px-8"
              aria-labelledby="journey-title"
              data-project-tracking-stage-workspace=""
            >
              <div
                className="relative mx-auto grid max-w-7xl items-stretch gap-4 lg:grid-cols-2 lg:gap-14"
                dir="ltr"
              >
                <section
                  className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.025]"
                  dir="rtl"
                  aria-labelledby="journey-title"
                  data-project-tracking-stage-map=""
                >
                  <header className="flex min-h-16 items-center border-b border-white/10 px-5 md:px-6">
                    <h2
                      id="journey-title"
                      className="text-xl font-semibold text-white"
                    >
                      رحلة التنفيذ
                    </h2>
                  </header>
                  <nav
                    className="relative flex flex-1 flex-col divide-y divide-white/10"
                    aria-label="اختيار مرحلة التنفيذ"
                    data-project-tracking-timeline=""
                  >
                    <span
                      className="absolute inset-y-0 left-6 w-px bg-gradient-to-b from-transparent via-[#D8A84E]/75 to-transparent shadow-[0_0_14px_rgba(216,168,78,.6)] lg:hidden"
                      aria-hidden
                    />
                    {detail.stages.map((stage, index) => {
                      const active = activeStage.id === stage.id;
                      return (
                        <Link
                          key={stage.id}
                          href={{
                            pathname: basePath,
                            query: {
                              historyPage: detail.pagination.history.page,
                              stage: stage.id,
                            },
                          }}
                          scroll={false}
                          aria-current={active ? "step" : undefined}
                          className={`group relative flex min-h-16 flex-1 items-center justify-between gap-4 py-4 pe-5 ps-12 text-right transition md:pe-6 ${
                            active
                              ? "bg-[linear-gradient(90deg,rgba(216,168,78,.02),rgba(216,168,78,.13))]"
                              : "bg-transparent hover:bg-white/[0.025]"
                          }`}
                          data-project-tracking-timeline-node=""
                        >
                          <span
                            className={`absolute left-[17px] z-10 grid size-[15px] place-items-center rounded-full border-2 bg-[#0B0E11] lg:hidden ${
                              active
                                ? "border-[#D8A84E] shadow-[0_0_16px_rgba(216,168,78,.65)]"
                                : "border-white/45"
                            }`}
                            aria-hidden
                          />
                          <span className="min-w-0">
                            <b
                              className={`block truncate text-sm md:text-base ${
                                active ? "text-[#E2B45C]" : "text-white/88"
                              }`}
                            >
                              {stagePresentationLabel(stage, index)}
                            </b>
                          </span>
                          <small
                            className={`shrink-0 text-xs ${
                              active ? "text-[#E2B45C]" : "text-white/38"
                            }`}
                          >
                            {projectTrackingStatusLabel(stage.status)}
                          </small>
                        </Link>
                      );
                    })}
                  </nav>
                  <Pagination
                    currentPage={detail.pagination.stages.page}
                    totalPages={detail.pagination.stages.totalPages}
                    basePath={basePath}
                    pageParam="stagePage"
                    query={{
                      historyPage: detail.pagination.history.page,
                    }}
                    ariaLabel="ترقيم مراحل التنفيذ"
                  />
                </section>

                <div
                  className="pointer-events-none absolute inset-y-0 left-1/2 z-10 hidden w-14 -translate-x-1/2 flex-col pt-16 lg:flex"
                  aria-hidden
                  data-project-tracking-timeline-rail=""
                >
                  <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#D8A84E] to-transparent shadow-[0_0_18px_rgba(216,168,78,.75)]" />
                  <div className="relative z-10 flex flex-1 flex-col">
                    {detail.stages.map((stage) => {
                      const active = activeStage.id === stage.id;
                      return (
                        <span
                          key={stage.id}
                          className="flex min-h-16 flex-1 items-center justify-center"
                        >
                          <span
                            className={`grid size-7 place-items-center rounded-full border-2 bg-[#0B0E11] text-[10px] ${
                              active
                                ? "border-[#D8A84E] text-[#E2B45C] shadow-[0_0_22px_rgba(216,168,78,.65)]"
                                : statusClasses[stage.status]
                            }`}
                          >
                            {statusDot(stage.status)}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <section
                  className="flex h-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-[#D8A84E]/28 bg-white/[0.025]"
                  dir="rtl"
                  aria-labelledby="active-stage-heading"
                  data-project-tracking-stage-detail=""
                >
                  <header className="border-b border-white/10 px-5 py-5 md:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2
                        id="active-stage-heading"
                        className="text-xl font-semibold text-white md:text-2xl"
                      >
                        {stagePresentationLabel(
                          activeStage,
                          detail.stages.indexOf(activeStage),
                        )}
                      </h2>
                      <span
                        className={`text-xs font-semibold ${
                          activeStage.status === "completed"
                            ? "text-emerald-300"
                            : activeStage.status === "in_progress"
                              ? "text-[#E2B45C]"
                              : "text-white/45"
                        }`}
                      >
                        {projectTrackingStatusLabel(activeStage.status)}
                      </span>
                    </div>
                    {activeStage.description ? (
                      <p className="mt-3 line-clamp-2 text-sm leading-7 text-white/58">
                        {activeStage.description}
                      </p>
                    ) : null}
                    <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <dt className="shrink-0 text-white/40">تاريخ البداية :</dt>
                        <dd className="min-w-0 whitespace-nowrap">
                          {formatDate(activeStage.startDate)}
                        </dd>
                      </div>
                      <div className="flex min-w-0 items-baseline gap-2">
                        <dt className="shrink-0 text-white/40">المدة المخططة :</dt>
                        <dd className="min-w-0 whitespace-nowrap">
                          {durationLabel(activeStage)}
                        </dd>
                      </div>
                    </dl>
                  </header>

                  <div className="flex flex-1 flex-col px-5 py-4 md:px-6">
                    <h3 className="mb-3 text-sm font-semibold text-[#E2B45C]">
                      بنود المرحلة
                    </h3>
                    {activeStage.items.length ? (
                      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/15">
                        {activeStage.items.map((item, index) => (
                          <Link
                            key={item.id}
                            href={{
                              pathname: basePath,
                              query: {
                                stage: activeStage.id,
                                stagePage: detail.pagination.stages.page,
                                item: item.id,
                                itemPage: detail.pagination.items.page,
                                historyPage: detail.pagination.history.page,
                              },
                            }}
                            scroll={false}
                            aria-current={
                              activeItem?.id === item.id ? "true" : undefined
                            }
                            className={`flex min-h-14 w-full items-center justify-between gap-3 border-b border-white/10 px-3 py-3 text-right transition last:border-b-0 md:px-4 ${
                              activeItem?.id === item.id
                                ? "bg-[#D8A84E]/10"
                                : "bg-transparent hover:bg-white/[0.025]"
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/12 text-xs text-white/45">
                                {index + 1}
                              </span>
                              <span className="min-w-0">
                                <b className="block truncate text-sm text-white/88">
                                  {item.name}
                                </b>
                                {item.description ? (
                                  <small className="mt-1 block truncate text-white/38">
                                    {item.description}
                                  </small>
                                ) : null}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2 text-[11px] sm:gap-3 sm:text-xs">
                              <span className={statusTextClasses[item.status]}>
                                {projectTrackingStatusLabel(item.status)}
                              </span>
                              <span className="text-white/42">
                                {item.updateCount} تحديث
                              </span>
                              <span className="text-base text-[#E2B45C]" aria-hidden>
                                ‹
                              </span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/45">
                        لا توجد بنود مرئية في هذه المرحلة.
                      </p>
                    )}
                    <Pagination
                      currentPage={detail.pagination.items.page}
                      totalPages={detail.pagination.items.totalPages}
                      basePath={basePath}
                      pageParam="itemPage"
                      query={{
                        stage: activeStage.id,
                        stagePage: detail.pagination.stages.page,
                        historyPage: detail.pagination.history.page,
                      }}
                      ariaLabel="ترقيم بنود المرحلة"
                    />
                  </div>
                </section>
              </div>
            </section>
          ) : null}

          <section
            id="tracking-item-documentation"
            className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-10 md:px-8"
            aria-labelledby="documentation-heading"
          >
            <SectionTitle>توثيق بنود المرحلة</SectionTitle>
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4">
                <h2
                  id="documentation-heading"
                  className="text-lg font-semibold text-[#E2B45C]"
                >
                  {activeUpdate?.title ??
                    activeItem?.name ??
                    "لا يوجد تحديث منشور"}
                </h2>
                {activeUpdate ? (
                  <>
                    <p className="mt-2 text-xs text-white/40">
                      تاريخ التوثيق: {formatDate(activeUpdate.occurredAt)}
                    </p>
                    <p className="mt-5 whitespace-pre-line text-sm leading-8 text-white/68">
                      {activeUpdate.body}
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm leading-7 text-white/45">
                    لم يُنشر توثيق لهذا البند بعد.
                  </p>
                )}
                {activeItem && activeItem.updates.length > 1 ? (
                  <div
                    className="mt-6 flex flex-wrap gap-2"
                    aria-label="اختيار تحديث البند"
                  >
                    {activeItem.updates.map((update) => (
                      <Link
                        key={update.id}
                        href={{
                          pathname: basePath,
                          query: {
                            ...selectionQuery,
                            update: update.id,
                            mediaPage: undefined,
                          },
                        }}
                        scroll={false}
                        aria-current={
                          activeUpdate?.id === update.id ? "true" : undefined
                        }
                        className={`rounded-lg border px-3 py-2 text-xs ${activeUpdate?.id === update.id ? "border-[#D8A84E] text-[#E2B45C]" : "border-white/10 text-white/55"}`}
                      >
                        {formatDate(update.occurredAt)}
                      </Link>
                    ))}
                  </div>
                ) : null}
                <Pagination
                  currentPage={detail.pagination.updates.page}
                  totalPages={detail.pagination.updates.totalPages}
                  basePath={basePath}
                  pageParam="updatePage"
                  query={{
                    stage: detail.selectedStageId ?? undefined,
                    item: detail.selectedItemId ?? undefined,
                    stagePage: detail.pagination.stages.page,
                    itemPage: detail.pagination.items.page,
                    historyPage: detail.pagination.history.page,
                  }}
                  ariaLabel="ترقيم تحديثات البند"
                />
              </div>
              <div>
                <MediaViewer
                  key={`${activeUpdate?.id ?? "empty"}:${detail.pagination.media.page}`}
                  media={activeUpdate?.media ?? []}
                />
                <Pagination
                  currentPage={detail.pagination.media.page}
                  totalPages={detail.pagination.media.totalPages}
                  basePath={basePath}
                  pageParam="mediaPage"
                  query={selectionQuery}
                  ariaLabel="ترقيم وسائط التحديث"
                />
              </div>
            </div>
          </section>

          <section
            id="updates"
            className="mx-auto grid max-w-7xl items-stretch gap-6 px-4 pb-14 md:px-8 lg:grid-cols-[1.15fr_.85fr]"
          >
            <div className="flex h-full flex-col rounded-[22px] border border-white/10 bg-white/[0.025] p-5 md:p-7">
              <h2 className="text-xl font-semibold text-[#E2B45C]">
                سجل التحديثات
              </h2>
              {detail.history.length ? (
                <ol className="mt-5 flex-1 divide-y divide-white/10">
                  {detail.history.map((update: ProjectTrackingUpdate) => (
                    <li
                      key={update.id}
                      className="grid gap-2 py-4 sm:grid-cols-[110px_1fr]"
                    >
                      <time className="text-sm font-semibold text-[#E2B45C]">
                        {formatDate(update.occurredAt)}
                      </time>
                      <div>
                        <h3 className="font-semibold">{update.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm leading-7 text-white/52">
                          {update.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-5 text-sm text-white/45">
                  لا توجد تحديثات منشورة بعد.
                </p>
              )}
              <Pagination
                currentPage={detail.pagination.history.page}
                totalPages={detail.pagination.history.totalPages}
                basePath={basePath}
                pageParam="historyPage"
                query={selectionQuery}
                previousLabel="السابق"
                nextLabel="عرض المزيد من السجل"
                ariaLabel="ترقيم سجل التحديثات"
              />
            </div>
            <aside className="h-full rounded-[22px] border border-[#D8A84E]/25 bg-white/[0.025] p-5 md:p-7">
              <h2 className="text-xl font-semibold text-[#E2B45C]">
                لمحة سريعة عن المشروع
              </h2>
              <div className="mt-6 grid grid-cols-2 gap-3 text-center">
                {[
                  { value: detail.counts.videos, label: "فيديوهات" },
                  { value: detail.counts.images, label: "صورة" },
                  { value: detail.counts.updates, label: "تحديثًا" },
                  {
                    value: `${detail.counts.completedStages}/${detail.counts.stages}`,
                    label: "مراحل مكتملة",
                  },
                ].map((fact) => (
                  <div
                    key={fact.label}
                    className="rounded-xl border border-white/10 p-4"
                  >
                    <strong className="block text-2xl text-[#E2B45C]">
                      {fact.value}
                    </strong>
                    <span className="mt-1 block text-xs text-white/50">
                      {fact.label}
                    </span>
                  </div>
                ))}
              </div>
              {detail.profile ? (
                <dl className="mt-5 space-y-3 border-t border-white/10 pt-5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-white/45">استلام المشروع</dt>
                    <dd>{formatDate(detail.profile.projectReceiptDate)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-white/45">استلام الترخيص</dt>
                    <dd>{formatDate(detail.profile.licenseReceiptDate)}</dd>
                  </div>
                  {detail.profile.contractorName ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-white/45">المقاول المنفذ</dt>
                      <dd>{detail.profile.contractorName}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              <Link
                href="/projects"
                className="mt-6 flex justify-center rounded-xl border border-[#D8A84E]/45 px-5 py-3 text-sm font-semibold text-[#E2B45C] hover:bg-[#D8A84E]/10"
              >
                العودة إلى جميع المشروعات
              </Link>
            </aside>
          </section>
        </>
      )}

      <section className="relative border-t border-[#D8A84E]/20 bg-[linear-gradient(90deg,#11100d,#19140c,#090b0d)] px-4 py-10 text-center md:px-8">
        <h2 className="text-2xl font-semibold text-[#E2B45C]">
          كل خطوة تنفيذ توثّق ثقتك
        </h2>
        <p className="mt-2 text-white/65">ننفذ بدقة، ونوافيك بكل جديد.</p>
        <Link
          href="/contact"
          className="mt-5 inline-flex rounded-xl bg-[#D8A84E] px-8 py-3 font-semibold text-black hover:bg-[#E2B45C]"
        >
          تواصل مع فريقنا
        </Link>
      </section>
    </main>
  );
}
