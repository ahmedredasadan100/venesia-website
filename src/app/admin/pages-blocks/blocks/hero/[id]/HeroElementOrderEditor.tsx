"use client";

import { useState } from "react";

import {
  ModuleEditorRepeaterCard,
  ModuleEditorRepeaterGrid,
} from "../../../../../../components/admin/page-blocks/ModuleEditorPresentation";
import { AdminActionButton, AdminFormSwitch } from "../../../../../../components/admin/ui";
import { AdminModuleTabIcon } from "../../../../../../components/admin/ui/AdminModuleTabs";
import { adminFormHintClassName } from "../../../../../../lib/admin/admin-ui-styles";
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
      <div data-project-hero-action-cards="">
        <ModuleEditorRepeaterGrid>
          {order.map((key, index) => {
            const label = PROJECT_HERO_ACTION_LABELS_AR[key];
            return (
              <article
                key={key}
                id={`project-hero-action-${key}`}
                className="min-w-0"
                data-project-hero-action-card={key}
              >
                <ModuleEditorRepeaterCard
                  title={label}
                  icon={<AdminModuleTabIcon name="section" />}
                  actions={
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.045] font-en text-[10px] font-semibold text-[#D8B87A]/70">
                      {index + 1}
                    </span>
                  }
                >
                  <AdminFormSwitch
                    name={PROJECT_HERO_ACTION_VISIBILITY_FIELDS[key]}
                    label="الظهور"
                    value="true"
                    uncheckedValue="false"
                    defaultChecked={visibility[key]}
                    embedded
                  />
                  <div
                    className="flex justify-end gap-1"
                    role="group"
                    aria-label={`ترتيب ${label}`}
                  >
                    <AdminActionButton
                      size="icon"
                      aria-label={`تحريك ${label} لأعلى`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </AdminActionButton>
                    <AdminActionButton
                      size="icon"
                      aria-label={`تحريك ${label} لأسفل`}
                      disabled={index === order.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </AdminActionButton>
                  </div>
                </ModuleEditorRepeaterCard>
              </article>
            );
          })}
        </ModuleEditorRepeaterGrid>
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
    <div data-hero-element-order-editor="" className="space-y-5">
      <p className={adminFormHintClassName({ textInset: true })}>
        حرّك العناصر بالأسهم. العنصر المخفي يحتفظ بمكانه في الترتيب.
      </p>
      <input type="hidden" name="hero_element_order" value={JSON.stringify(order)} />
      <ul className="space-y-3">
        {order.map((key, index) => (
          <li key={key} className="min-w-0">
            <ModuleEditorRepeaterCard
              title={HERO_ELEMENT_LABELS_AR[key]}
              icon={<AdminModuleTabIcon name="section" />}
              actions={<span className="font-en text-xs text-white/55">{index + 1}</span>}
            >
              <div className="flex justify-end gap-2" role="group" aria-label={`ترتيب ${HERO_ELEMENT_LABELS_AR[key]}`}>
                <AdminActionButton size="icon" disabled={index === 0} onClick={() => move(index, -1)}
                  title={index === 0 ? "العنصر في أول الترتيب" : "تحريك لأعلى"}
                  aria-label={index === 0 ? `${HERO_ELEMENT_LABELS_AR[key]} في أول الترتيب ولا يمكن تحريكه لأعلى` : `تحريك ${HERO_ELEMENT_LABELS_AR[key]} لأعلى`}>
                  ↑
                </AdminActionButton>
                <AdminActionButton size="icon" disabled={index === order.length - 1} onClick={() => move(index, 1)}
                  title={index === order.length - 1 ? "العنصر في آخر الترتيب" : "تحريك لأسفل"}
                  aria-label={index === order.length - 1 ? `${HERO_ELEMENT_LABELS_AR[key]} في آخر الترتيب ولا يمكن تحريكه لأسفل` : `تحريك ${HERO_ELEMENT_LABELS_AR[key]} لأسفل`}>
                  ↓
                </AdminActionButton>
              </div>
            </ModuleEditorRepeaterCard>
          </li>
        ))}
      </ul>
    </div>
  );

}
