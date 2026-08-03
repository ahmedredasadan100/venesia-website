"use client";

import { useId, useState, type ReactNode } from "react";

import {
  getEntityReviewScore,
  type EntityReviewAnalysisCardDefinition,
  type EntityReviewCheck,
  type EntityReviewSummaryEntry,
} from "../../../lib/admin/review/entity-review-presentation";

type AdminEntityReviewPanelProps = {
  entityKey: string;
  navigationEventName: string;
  decisionTitle: string;
  checks: readonly EntityReviewCheck[];
  guidanceCards: readonly EntityReviewAnalysisCardDefinition[];
  decisionCards: ReactNode;
  validationDescription: string;
  summaryEntries: readonly EntityReviewSummaryEntry[];
};

export function AdminEntityReviewDecisionCard({
  id,
  title,
  description,
  badge,
  children,
  className = "",
}: {
  id: string;
  title: string;
  description: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`flex min-w-0 flex-col rounded-[22px] border border-white/10 bg-[#090D13]/88 p-4 ${className}`}
      data-admin-entity-review-decision={id}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/82">{title}</p>
          <p className="mt-1 text-xs leading-5 text-white/38">{description}</p>
        </div>
        {badge}
      </div>
      {children}
    </article>
  );
}

export function AdminEntityReviewCorrectionButton({
  navigationEventName,
  tabId,
  targetId,
  label = "إصلاح",
  className = "",
}: {
  navigationEventName: string;
  tabId: string;
  targetId?: string;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent(navigationEventName, {
            detail: { tabId, targetId },
          }),
        );
      }}
      className={`shrink-0 rounded-lg border border-[#D8B87A]/28 bg-[#D8B87A]/8 px-3 py-1.5 text-xs font-semibold text-[#F2D99B] transition hover:border-[#D8B87A]/50 hover:bg-[#D8B87A]/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/55 ${className}`}
    >
      {label}
    </button>
  );
}

export default function AdminEntityReviewPanel({
  entityKey,
  navigationEventName,
  decisionTitle,
  checks,
  guidanceCards,
  decisionCards,
  validationDescription,
  summaryEntries,
}: AdminEntityReviewPanelProps) {
  const instanceId = useId().replace(/:/g, "");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(
    () => new Set(),
  );
  const score = getEntityReviewScore(checks);
  const blockingIssues = checks.filter(
    (item) => item.blocksPublish && item.status === "fail",
  );
  const suggestions = checks.filter(
    (item) => item.status === "warn" || item.status === "info",
  );
  const decisionsTitleId = `${instanceId}-entity-review-decisions-title`;
  const analysisId = `${instanceId}-entity-review-analysis`;
  const analysisTitleId = `${analysisId}-title`;

  function toggleCard(cardId: string) {
    setExpandedCards((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  return (
    <section
      className="space-y-5"
      data-admin-entity-review={entityKey}
      data-admin-entity-review-presentation="dashboard"
    >
      <section aria-labelledby={decisionsTitleId}>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D8B87A]/65">
              قرارات سريعة
            </p>
            <h2
              id={decisionsTitleId}
              className="mt-1 text-lg font-semibold text-white/88"
            >
              {decisionTitle}
            </h2>
          </div>
          <p className="hidden text-xs text-white/35 sm:block">
            تبقى هذه القرارات مكشوفة دائمًا.
          </p>
        </div>

        <div
          className="grid items-stretch gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,1fr)]"
          data-admin-entity-review-decisions
        >
          <article
            className="flex min-w-0 flex-col rounded-[22px] border border-[#D8B87A]/24 bg-[#D8B87A]/[0.065] p-4 md:p-5"
            data-admin-entity-review-decision="score"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/82">
                  درجة جاهزية النشر
                </p>
                <p className="mt-1.5 text-xs leading-5 text-white/42">
                  الدرجة إرشادية ولا تمنع النشر وحدها.
                </p>
                <span
                  className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                    blockingIssues.length
                      ? "border-red-300/20 bg-red-300/[0.07] text-red-100/75"
                      : "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100/75"
                  }`}
                >
                  {blockingIssues.length
                    ? "النشر يتطلب إصلاحًا"
                    : "النشر متاح"}
                </span>
              </div>
              <div
                className="grid size-20 shrink-0 place-items-center rounded-full p-1.5"
                style={{
                  background: `conic-gradient(#D8B87A ${score}%, rgba(255,255,255,.08) ${score}% 100%)`,
                }}
                aria-label={`درجة جاهزية النشر ${score} من 100`}
              >
                <span className="grid size-full place-items-center rounded-full bg-[#0A0E14] font-en text-xl font-semibold text-white">
                  {score}
                </span>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2">
              <ScoreDecision label="المشكلات" value={blockingIssues.length} />
              <ScoreDecision label="التحسينات" value={suggestions.length} />
            </dl>
            <button
              type="button"
              onClick={() =>
                document.getElementById(analysisId)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
              aria-controls={analysisId}
              className="mt-4 inline-flex min-h-9 self-start items-center justify-center rounded-full border border-[#D8B87A]/25 px-4 py-2 text-xs font-semibold text-[#EED49B] transition hover:border-[#D8B87A]/45 hover:bg-[#D8B87A]/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/55"
              data-admin-entity-review-score-details
            >
              عرض التفاصيل
            </button>
          </article>

          {decisionCards}
        </div>
      </section>

      <section id={analysisId} aria-labelledby={analysisTitleId}>
        <div className="mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D8B87A]/65">
            التحليلات
          </p>
          <h2
            id={analysisTitleId}
            className="mt-1 text-lg font-semibold text-white/88"
          >
            مؤشرات الجاهزية
          </h2>
        </div>
        <div
          className="grid items-start gap-4 lg:grid-cols-3"
          data-admin-entity-review-analysis-grid
          data-admin-entity-review-guidance-grid
        >
          {guidanceCards.map((definition) => {
            const items = checks.filter((item) =>
              definition.checkIds.includes(item.id),
            );
            return (
              <ReviewAnalysisCard
                key={definition.id}
                instanceId={instanceId}
                definition={definition}
                items={items}
                expanded={expandedCards.has(definition.id)}
                onToggle={() => toggleCard(definition.id)}
                variant="guidance"
                navigationEventName={navigationEventName}
              />
            );
          })}
        </div>
        <div className="mt-4" data-admin-entity-review-validation-row>
          <ReviewAnalysisCard
            instanceId={instanceId}
            definition={{
              id: "validation",
              title: "التحقق العام (Validation)",
              description: validationDescription,
              checkIds: [],
            }}
            items={blockingIssues}
            expanded={expandedCards.has("validation")}
            onToggle={() => toggleCard("validation")}
            variant="validation"
            navigationEventName={navigationEventName}
          />
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section
          className="rounded-[22px] border border-white/10 bg-[#090D13]/82 p-5"
          aria-labelledby={`${instanceId}-entity-review-notes-title`}
          data-admin-entity-review-notes
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D8B87A]/65">
                إرشادات
              </p>
              <h2
                id={`${instanceId}-entity-review-notes-title`}
                className="mt-1 text-base font-semibold text-white/85"
              >
                ملاحظات عامة
              </h2>
            </div>
            <span className="rounded-full border border-white/10 px-2.5 py-1 font-en text-[11px] text-white/45">
              {suggestions.length}
            </span>
          </div>
          {suggestions.length ? (
            <ul className="mt-4 space-y-3">
              {suggestions.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 text-sm leading-6 text-white/55"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-[#D8B87A]/75"
                  />
                  <span>
                    <strong className="font-semibold text-white/72">
                      {item.label}:
                    </strong>{" "}
                    {item.hint}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100/70">
              لا توجد اقتراحات غير مانعة في الحالة الحالية.
            </p>
          )}
        </section>

        <section
          className="rounded-[22px] border border-white/10 bg-[#090D13]/82 p-5"
          aria-labelledby={`${instanceId}-entity-review-status-summary-title`}
          data-admin-entity-review-status-summary
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D8B87A]/65">
            عرض فقط
          </p>
          <h2
            id={`${instanceId}-entity-review-status-summary-title`}
            className="mt-1 text-base font-semibold text-white/85"
          >
            ملخص الحالة
          </h2>
          <ol className="mt-4 space-y-0">
            {summaryEntries.map((entry, index) => (
              <TimelineEntry
                key={entry.id}
                title={entry.title}
                value={entry.value}
                last={index === summaryEntries.length - 1}
              />
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}

function ScoreDecision({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
      <dt className="text-[10px] text-white/38">{label}</dt>
      <dd className="mt-1 font-en text-base font-semibold text-white/78">
        {value}
      </dd>
    </div>
  );
}

type ReviewAnalysisDefinition = EntityReviewAnalysisCardDefinition | {
  id: "validation";
  title: string;
  description: string;
  checkIds: readonly string[];
};

function ReviewAnalysisCard({
  instanceId,
  definition,
  items,
  expanded,
  onToggle,
  variant,
  navigationEventName,
}: {
  instanceId: string;
  definition: ReviewAnalysisDefinition;
  items: readonly EntityReviewCheck[];
  expanded: boolean;
  onToggle: () => void;
  variant: "guidance" | "validation";
  navigationEventName: string;
}) {
  const score = getEntityReviewScore(items);
  const issues = items.filter((item) => item.status !== "pass");
  const errors = issues.filter(
    (item) => item.blocksPublish && item.status === "fail",
  ).length;
  const warnings = issues.filter((item) => item.status === "warn").length;
  const improvements = issues.filter((item) => item.status === "info").length;
  const topIssue = issues.find((item) => item.status === "fail") ?? issues[0];
  const panelId = `${instanceId}-entity-review-analysis-${definition.id}`;
  const publicationBlocked = items.some(
    (item) => item.blocksPublish && item.status === "fail",
  );

  return (
    <article
      className={`overflow-hidden rounded-[22px] border bg-[#090D13]/88 shadow-[0_18px_44px_rgba(0,0,0,0.18)] ${
        variant === "validation"
          ? publicationBlocked
            ? "border-red-300/25"
            : "border-emerald-300/18"
          : `${expanded ? "min-h-[23.5rem]" : "h-[23.5rem]"} border-white/10`
      }`}
      data-admin-entity-review-analysis={definition.id}
      data-admin-entity-review-expanded={expanded ? "true" : "false"}
      data-admin-entity-review-analysis-tier={
        variant === "validation" ? "blocking" : "guidance"
      }
    >
      <div
        className={
          variant === "validation"
            ? "grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(15rem,auto)_auto] md:items-center md:p-5"
            : "flex h-full flex-col p-4"
        }
      >
        {variant === "validation" ? (
          <>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-red-200/55">
                تحقق مانع للنشر
              </p>
              <h3 className="mt-1 text-base font-semibold text-white/88">
                {definition.title}
              </h3>
              <p className="mt-1 text-xs leading-5 text-white/42">
                {definition.description}
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3">
              <div
                className={`grid size-14 shrink-0 place-items-center rounded-xl border font-en text-xl font-semibold ${
                  publicationBlocked
                    ? "border-red-300/20 bg-red-300/[0.07] text-red-100/80"
                    : "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100/80"
                }`}
              >
                {errors}
              </div>
              <div className="min-w-0">
                <p
                  className={`text-xs font-semibold ${
                    publicationBlocked
                      ? "text-red-100/78"
                      : "text-emerald-100/75"
                  }`}
                >
                  {publicationBlocked ? "النشر ممنوع" : "النشر مسموح"}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-white/38">
                  {publicationBlocked
                    ? `${errors} ${
                        errors === 1
                          ? "مشكلة مانعة تحتاج إصلاحًا."
                          : "مشكلات مانعة تحتاج إصلاحًا."
                      }`
                    : "الحقول المطلوبة والقيم الأساسية سليمة."}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex min-h-16 items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white/88">
                  {definition.title}
                </h3>
                <p className="mt-1 min-h-10 text-xs leading-5 text-white/38">
                  {definition.description}
                </p>
              </div>
              <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-[#D8B87A]/22 bg-[#D8B87A]/[0.075] font-en text-base font-semibold text-[#F0D69F]">
                {score}
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2">
              <AnalysisCount label="الأخطاء" value={errors} tone="error" />
              <AnalysisCount
                label="التنبيهات"
                value={warnings}
                tone="warning"
              />
              <AnalysisCount
                label="التحسينات"
                value={improvements}
                tone="info"
              />
            </dl>

            <div className="mt-3 min-h-24 rounded-xl border border-white/8 bg-black/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                أهم مشكلة
              </p>
              {topIssue ? (
                <div className="mt-1.5">
                  <p className="text-sm font-semibold text-white/72">
                    {topIssue.label}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/42">
                    {topIssue.hint}
                  </p>
                </div>
              ) : (
                <p className="mt-1.5 text-sm font-medium text-emerald-200/70">
                  لا توجد مشكلات حالية.
                </p>
              )}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className={`${
            variant === "validation" ? "md:justify-self-end" : "mt-4 self-start"
          } inline-flex min-h-10 items-center justify-center rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/[0.065] px-4 py-2 text-xs font-semibold text-[#EED49B] transition hover:border-[#D8B87A]/45 hover:bg-[#D8B87A]/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/55`}
        >
          {expanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}
          <span
            aria-hidden="true"
            className={`ms-2 transition ${expanded ? "rotate-180" : ""}`}
          >
            ⌄
          </span>
        </button>
      </div>

      {expanded ? (
        <div
          id={panelId}
          className="border-t border-white/10 bg-black/15 p-5"
          role="region"
          aria-label={`تفاصيل ${definition.title}`}
        >
          <ReviewIssueList
            items={issues}
            navigationEventName={navigationEventName}
          />
        </div>
      ) : null}
    </article>
  );
}

function AnalysisCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "error" | "warning" | "info";
}) {
  const toneClassName =
    tone === "error"
      ? "text-red-200/80"
      : tone === "warning"
        ? "text-amber-200/80"
        : "text-sky-200/75";
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] px-2 py-2.5 text-center">
      <dt className="text-[10px] leading-4 text-white/35">{label}</dt>
      <dd className={`mt-1 font-en text-base font-semibold ${toneClassName}`}>
        {value}
      </dd>
    </div>
  );
}

function ReviewIssueList({
  items,
  navigationEventName,
}: {
  items: readonly EntityReviewCheck[];
  navigationEventName: string;
}) {
  if (!items.length) {
    return (
      <p className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100/75">
        لا توجد مشكلات في هذا التحليل.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <ReviewIssueCard
          key={item.id}
          item={item}
          navigationEventName={navigationEventName}
        />
      ))}
    </div>
  );
}

function ReviewIssueCard({
  item,
  navigationEventName,
}: {
  item: EntityReviewCheck;
  navigationEventName: string;
}) {
  const tone =
    item.severity === "error"
      ? "border-red-400/20 bg-red-400/[0.07]"
      : item.severity === "warning"
        ? "border-[#D8B87A]/18 bg-[#D8B87A]/[0.07]"
        : "border-sky-300/15 bg-sky-300/[0.055]";
  const severityLabel =
    item.severity === "error"
      ? "خطأ"
      : item.severity === "warning"
        ? "تنبيه"
        : "تحسين";
  return (
    <article
      className={`rounded-xl border px-4 py-3 ${tone}`}
      data-admin-entity-review-issue={item.id}
      data-admin-entity-review-severity={item.severity}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-white/78">
              {item.label}
            </h4>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/42">
              {severityLabel}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-6 text-white/48">
            {item.hint}
          </p>
        </div>
        {item.correctionTarget ? (
          <AdminEntityReviewCorrectionButton
            navigationEventName={navigationEventName}
            tabId={item.correctionTarget.tabId}
            targetId={item.correctionTarget.targetId}
          />
        ) : null}
      </div>
    </article>
  );
}

function TimelineEntry({
  title,
  value,
  last = false,
}: {
  title: string;
  value: string;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last ? (
        <span
          aria-hidden="true"
          className="absolute top-3 bottom-0 start-[5px] w-px bg-white/10"
        />
      ) : null}
      <span
        aria-hidden="true"
        className="relative mt-1.5 size-3 shrink-0 rounded-full border-2 border-[#D8B87A]/70 bg-[#0A0E14]"
      />
      <div>
        <p className="text-sm font-semibold text-white/68">{title}</p>
        <p className="mt-1 text-xs leading-5 text-white/38">{value}</p>
      </div>
    </li>
  );
}
