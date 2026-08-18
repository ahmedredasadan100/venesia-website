"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import PublicMediaImage from "../public/PublicMediaImage";
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
  const initialStageId = detail.currentStageId ?? detail.stages[0]?.id ?? null;
  const [stageId, setStageId] = useState(initialStageId);
  const activeStage =
    detail.stages.find((stage) => stage.id === stageId) ??
    detail.stages[0] ??
    null;
  const initialItemId =
    activeStage?.items.find((item) => item.status === "in_progress")?.id ??
    activeStage?.items[0]?.id ??
    null;
  const [itemId, setItemId] = useState(initialItemId);
  const activeItem =
    activeStage?.items.find((item) => item.id === itemId) ??
    activeStage?.items[0] ??
    null;
  const [updateId, setUpdateId] = useState<number | null>(null);
  const activeUpdate =
    activeItem?.updates.find((update) => update.id === updateId) ??
    activeItem?.updates[0] ??
    null;
  const allUpdates = useMemo(
    () =>
      detail.stages
        .flatMap((stage) => stage.items.flatMap((item) => item.updates))
        .sort(
          (a, b) =>
            new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
        ),
    [detail.stages],
  );

  function selectStage(stage: ProjectTrackingStage) {
    setStageId(stage.id);
    const nextItem =
      stage.items.find((item) => item.status === "in_progress") ??
      stage.items[0] ??
      null;
    setItemId(nextItem?.id ?? null);
    setUpdateId(nextItem?.updates[0]?.id ?? null);
  }

  function selectItem(id: number) {
    setItemId(id);
    const item = activeStage?.items.find((candidate) => candidate.id === id);
    setUpdateId(item?.updates[0]?.id ?? null);
  }

  const heroImage = detail.latestVisual ?? detail.project.heroImage;
  const latestDate = detail.latestUpdate?.occurredAt;

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
            {detail.project.location ? (
              <p className="mt-4 text-base text-white/72">
                ⌖ {detail.project.location}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              {activeStage ? (
                <span
                  className={`rounded-lg border px-4 py-2 ${statusClasses[activeStage.status]}`}
                >
                  {projectTrackingStatusLabel(activeStage.status)}
                </span>
              ) : null}
              {activeStage ? (
                <span className="rounded-lg border border-white/10 bg-black/45 px-4 py-2 text-white/70">
                  المرحلة الحالية:{" "}
                  <b className="text-[#E2B45C]">{activeStage.name}</b>
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
          <section
            className="border-b border-white/10 px-4 py-10 md:px-8"
            aria-labelledby="journey-title"
          >
            <div className="mx-auto max-w-7xl">
              <SectionTitle>رحلة التنفيذ</SectionTitle>
              <div
                id="journey-title"
                className="relative grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]"
              >
                <span
                  className="absolute left-[8%] right-[8%] top-7 hidden h-px bg-gradient-to-l from-transparent via-[#D8A84E]/70 to-transparent md:block"
                  aria-hidden
                />
                {detail.stages.map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => selectStage(stage)}
                    aria-pressed={activeStage?.id === stage.id}
                    className="relative z-10 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0B0E11] p-3 text-right transition hover:border-[#D8A84E]/45 md:flex-col md:text-center"
                  >
                    <span
                      className={`grid size-14 shrink-0 place-items-center rounded-full border-2 text-xl ${activeStage?.id === stage.id ? "border-[#D8A84E] bg-[#D8A84E]/15 text-[#E2B45C] shadow-[0_0_24px_rgba(216,168,78,.28)]" : statusClasses[stage.status]}`}
                    >
                      {statusDot(stage.status)}
                    </span>
                    <span>
                      <b
                        className={
                          activeStage?.id === stage.id
                            ? "text-[#E2B45C]"
                            : "text-white"
                        }
                      >
                        {stage.name}
                      </b>
                      <small className="mt-1 block text-xs text-white/45">
                        {projectTrackingStatusLabel(stage.status)}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {activeStage ? (
            <section
              className="mx-auto max-w-7xl px-4 py-10 md:px-8"
              aria-labelledby="active-stage-heading"
            >
              <div className="rounded-[24px] border border-[#D8A84E]/35 bg-white/[0.025] p-5 md:p-7">
                <div className="grid gap-7 lg:grid-cols-[1fr_1.15fr]">
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <h2
                        id="active-stage-heading"
                        className="text-2xl font-semibold text-[#E2B45C]"
                      >
                        {activeStage.name}
                      </h2>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${statusClasses[activeStage.status]}`}
                      >
                        {projectTrackingStatusLabel(activeStage.status)}
                      </span>
                    </div>
                    {activeStage.description ? (
                      <p className="mt-4 leading-8 text-white/65">
                        {activeStage.description}
                      </p>
                    ) : null}
                    <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-white/10 p-3">
                        <dt className="text-white/40">تاريخ البداية</dt>
                        <dd className="mt-1">
                          {formatDate(activeStage.startDate)}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/10 p-3">
                        <dt className="text-white/40">المدة المخططة</dt>
                        <dd className="mt-1">{durationLabel(activeStage)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-[#E2B45C]">
                      بنود المرحلة
                    </h3>
                    {activeStage.items.length ? (
                      <div className="space-y-2">
                        {activeStage.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => selectItem(item.id)}
                            aria-pressed={activeItem?.id === item.id}
                            className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-right ${activeItem?.id === item.id ? "border-[#D8A84E]/55 bg-[#D8A84E]/10" : "border-white/10 bg-black/20 hover:border-white/20"}`}
                          >
                            <span>
                              <b className="block text-sm">{item.name}</b>
                              {item.description ? (
                                <small className="mt-1 block line-clamp-1 text-white/45">
                                  {item.description}
                                </small>
                              ) : null}
                            </span>
                            <span
                              className={`shrink-0 rounded-lg border px-2 py-1 text-xs ${statusClasses[item.status]}`}
                            >
                              {projectTrackingStatusLabel(item.status)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/45">
                        لا توجد بنود مرئية في هذه المرحلة.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section
            className="mx-auto max-w-7xl px-4 pb-10 md:px-8"
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
                      <button
                        key={update.id}
                        type="button"
                        onClick={() => setUpdateId(update.id)}
                        aria-pressed={activeUpdate?.id === update.id}
                        className={`rounded-lg border px-3 py-2 text-xs ${activeUpdate?.id === update.id ? "border-[#D8A84E] text-[#E2B45C]" : "border-white/10 text-white/55"}`}
                      >
                        {formatDate(update.occurredAt)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <MediaViewer
                key={activeUpdate?.id ?? "empty"}
                media={activeUpdate?.media ?? []}
              />
            </div>
          </section>

          <section
            id="updates"
            className="mx-auto grid max-w-7xl gap-6 px-4 pb-14 md:px-8 lg:grid-cols-[1.15fr_.85fr]"
          >
            <div className="rounded-[22px] border border-white/10 bg-white/[0.025] p-5 md:p-7">
              <h2 className="text-xl font-semibold text-[#E2B45C]">
                سجل التحديثات
              </h2>
              {allUpdates.length ? (
                <ol className="mt-5 divide-y divide-white/10">
                  {allUpdates.map((update: ProjectTrackingUpdate) => (
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
            </div>
            <aside className="rounded-[22px] border border-[#D8A84E]/25 bg-white/[0.025] p-5 md:p-7">
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
