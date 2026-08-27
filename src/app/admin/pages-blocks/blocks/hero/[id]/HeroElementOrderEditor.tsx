"use client";

import { useState } from "react";

import { MODULE_EDITOR_CONTROL_CARD_CLASS_NAME } from "../../../../../../components/admin/page-blocks/ModuleEditorPresentation";
import { AdminFormSwitch } from "../../../../../../components/admin/ui";
import {
  DEFAULT_HERO_ELEMENT_ORDER,
  HERO_ELEMENT_LABELS_AR,
  PROJECT_HERO_ACTION_LABELS_AR,
  normalizeProjectHeroActionOrder,
  normalizeHeroElementOrder,
  type HeroElementKey,
  type ProjectHeroActionKey,
} from "../../../../../../lib/hero/hero-content-controls";

type HeroElementOrderEditorProps = {
  defaultOrder?: unknown;
  allowedKeys?: readonly HeroElementKey[];
  projectActions?: {
    defaultOrder?: unknown;
    visibility: Record<ProjectHeroActionKey, boolean>;
  };
};

const PROJECT_HERO_ACTION_VISIBILITY_FIELDS: Record<
  ProjectHeroActionKey,
  string
> = {
  download: "show_project_download_action",
  tracking: "show_project_tracking_action",
  reservation: "show_project_reservation_action",
};

function ProjectHeroActionOrderEditor({
  defaultOrder,
  visibility,
}: NonNullable<HeroElementOrderEditorProps["projectActions"]>) {
  const [order, setOrder] = useState<ProjectHeroActionKey[]>(() =>
    normalizeProjectHeroActionOrder(defaultOrder),
  );

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= order.length) return;
    setOrder((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  return (
    <div data-project-hero-action-order-editor="" className="space-y-3">
      <input
        type="hidden"
        name="project_action_order"
        value={JSON.stringify(order)}
      />
      <div
        className="grid min-w-0 gap-3 md:grid-cols-3"
        data-project-hero-action-cards=""
      >
        {order.map((key, index) => {
          const label = PROJECT_HERO_ACTION_LABELS_AR[key];
          return (
            <article
              key={key}
              id={`project-hero-action-${key}`}
              className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} flex min-w-0 flex-col gap-3`}
              data-project-hero-action-card={key}
            >
              <header className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 text-sm font-semibold text-white/78">
                  {label}
                </span>
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.045] font-en text-[10px] font-semibold text-[#D8B87A]/70">
                  {index + 1}
                </span>
              </header>
              <AdminFormSwitch
                name={PROJECT_HERO_ACTION_VISIBILITY_FIELDS[key]}
                label="الظهور"
                value="true"
                uncheckedValue="false"
                defaultChecked={visibility[key]}
                surface
                className="min-h-12"
              />
              <div
                className="mt-auto inline-flex self-end rounded-xl border border-white/10 bg-black/20 p-1"
                role="group"
                aria-label={`ترتيب ${label}`}
              >
                <button
                  type="button"
                  aria-label={`تحريك ${label} لأعلى`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="inline-flex h-8 w-10 items-center justify-center rounded-lg text-sm text-white/65 transition enabled:hover:bg-white/[0.05] enabled:hover:text-[#F2D99B] disabled:cursor-not-allowed disabled:opacity-25"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`تحريك ${label} لأسفل`}
                  disabled={index === order.length - 1}
                  onClick={() => move(index, 1)}
                  className="inline-flex h-8 w-10 items-center justify-center rounded-lg text-sm text-white/65 transition enabled:hover:bg-white/[0.05] enabled:hover:text-[#F2D99B] disabled:cursor-not-allowed disabled:opacity-25"
                >
                  ↓
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default function HeroElementOrderEditor({
  defaultOrder,
  allowedKeys,
  projectActions,
}: HeroElementOrderEditorProps) {
  const [order, setOrder] = useState<HeroElementKey[]>(() =>
    normalizeHeroElementOrder(
      defaultOrder ?? allowedKeys ?? DEFAULT_HERO_ELEMENT_ORDER,
      allowedKeys,
    ),
  );

  if (projectActions) {
    return <ProjectHeroActionOrderEditor {...projectActions} />;
  }

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= order.length) return;
    setOrder((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  return (
    <div data-hero-element-order-editor="" className="space-y-4">
      <p className="rounded-2xl border border-white/10 bg-[#05070B]/72 px-4 py-3 text-xs leading-6 text-white/45">
        حرّك العناصر بالأسهم. العنصر المخفي يحتفظ بمكانه في الترتيب.
      </p>
      <input
        type="hidden"
        name="hero_element_order"
        value={JSON.stringify(order)}
      />
      <ul className="space-y-2">
        {order.map((key, index) => (
          <li
            key={key}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/10 bg-[#05070B]/72 p-3"
          >
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-white/[0.045] font-en text-[11px] font-semibold text-[#D8B87A]/70">
              {index + 1}
            </span>
            <span className="min-w-0 text-sm font-medium text-white/80">
              {HERO_ELEMENT_LABELS_AR[key]}
            </span>
            <div
              className="inline-flex shrink-0 gap-1 rounded-xl border border-white/10 bg-black/20 p-1"
              role="group"
              aria-label={`ترتيب ${HERO_ELEMENT_LABELS_AR[key]}`}
            >
              <button
                type="button"
                title={index === 0 ? "العنصر في أول الترتيب" : "تحريك لأعلى"}
                aria-label={
                  index === 0
                    ? `${HERO_ELEMENT_LABELS_AR[key]} في أول الترتيب ولا يمكن تحريكه لأعلى`
                    : `تحريك ${HERO_ELEMENT_LABELS_AR[key]} لأعلى`
                }
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="inline-flex h-8 w-10 items-center justify-center rounded-lg text-sm text-white/65 transition enabled:hover:bg-white/[0.05] enabled:hover:text-[#F2D99B] disabled:cursor-not-allowed disabled:opacity-25"
              >
                ↑
              </button>
              <button
                type="button"
                title={
                  index === order.length - 1
                    ? "العنصر في آخر الترتيب"
                    : "تحريك لأسفل"
                }
                aria-label={
                  index === order.length - 1
                    ? `${HERO_ELEMENT_LABELS_AR[key]} في آخر الترتيب ولا يمكن تحريكه لأسفل`
                    : `تحريك ${HERO_ELEMENT_LABELS_AR[key]} لأسفل`
                }
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
                className="inline-flex h-8 w-10 items-center justify-center rounded-lg text-sm text-white/65 transition enabled:hover:bg-white/[0.05] enabled:hover:text-[#F2D99B] disabled:cursor-not-allowed disabled:opacity-25"
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
