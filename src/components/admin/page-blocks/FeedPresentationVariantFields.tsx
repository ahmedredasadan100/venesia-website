"use client";

import { useState, type ReactNode } from "react";

import type {
  FeedPresentationDensity,
  FeedPresentationLayout,
  FeedPresentationVariants,
  TopicsFeedType,
} from "../../../lib/feed-modules/types";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import { AdminFormListboxSelect } from "../ui";
import AdminFormSwitch from "../ui/AdminFormSwitch";
import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorSectionHeading,
} from "./ModuleEditorPresentation";

const ALL_LAYOUT_OPTIONS = [
  { value: "slider", label: "Slider" },
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
];
const STATIC_LAYOUT_OPTIONS = ALL_LAYOUT_OPTIONS.filter(
  ({ value }) => value !== "slider",
);
const DENSITY_OPTIONS = [1, 2, 3].map((value) => ({
  value: String(value),
  label: String(value),
}));

function VariantPanel({
  feedType,
  activeFeedType,
  children,
}: {
  feedType: TopicsFeedType;
  activeFeedType: TopicsFeedType;
  children: ReactNode;
}) {
  const active = feedType === activeFeedType;
  return (
    <div
      className={active ? "" : "hidden"}
      data-feed-presentation-controls-for={feedType}
      data-feed-presentation-controls-active={active ? "true" : "false"}
    >
      {children}
    </div>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  min = 1,
  max,
}: {
  name: string;
  label: string;
  defaultValue: number;
  min?: number;
  max?: number;
}) {
  return (
    <ModuleEditorField nature="standard" span={4}>
      <label className="block space-y-2">
        <span className="text-xs font-semibold text-white/55">{label}</span>
        <input
          name={name}
          aria-label={label}
          type="number"
          min={min}
          max={max}
          defaultValue={defaultValue}
          className={fieldClassName()}
        />
      </label>
    </ModuleEditorField>
  );
}

function DensityField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: FeedPresentationDensity;
}) {
  return (
    <ModuleEditorField nature="standard" span={4}>
      <AdminFormListboxSelect
        name={name}
        label={label}
        defaultValue={String(value)}
        options={DENSITY_OPTIONS}
      />
    </ModuleEditorField>
  );
}

function SwitchField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <ModuleEditorField nature="binary-state" span={4}>
      <AdminFormSwitch
        name={name}
        label={label}
        defaultChecked={defaultChecked}
        uncheckedValue="false"
        value="true"
      />
    </ModuleEditorField>
  );
}

function ListSettings({
  feedType,
  list,
  visible,
}: {
  feedType: TopicsFeedType;
  list: FeedPresentationVariants[TopicsFeedType]["list"];
  visible: boolean;
}) {
  return (
    <div className={visible ? "" : "hidden"} data-feed-list-settings-for={feedType}>
      <ModuleEditorFieldGrid>
        <NumberField
          name={`${feedType}_list_items_per_group`}
          label="عدد العناصر في المجموعة"
          defaultValue={list.itemsPerGroup}
        />
        <SwitchField
          name={`${feedType}_list_show_dots`}
          label="إظهار مؤشرات التنقل"
          defaultChecked={list.showDots}
        />
        <NumberField
          name={`${feedType}_list_interval_seconds`}
          label="مدة الانتقال بالثواني"
          defaultValue={list.intervalSeconds}
          min={3}
          max={60}
        />
      </ModuleEditorFieldGrid>
    </div>
  );
}

function LatestFields({
  activeFeedType,
  config,
}: {
  activeFeedType: TopicsFeedType;
  config: FeedPresentationVariants["latest"];
}) {
  const [layout, setLayout] = useState<FeedPresentationLayout>(config.layout);
  return (
    <VariantPanel feedType="latest" activeFeedType={activeFeedType}>
      <ModuleEditorFieldGrid>
        <ModuleEditorField nature="standard" span={4}>
          <AdminFormListboxSelect
            name="latest_layout"
            label="النمط"
            value={layout}
            onChange={(value) => setLayout(value as FeedPresentationLayout)}
            options={ALL_LAYOUT_OPTIONS}
          />
        </ModuleEditorField>
        <div className={layout !== "list" ? "contents" : "hidden"}>
          <DensityField
            name="latest_density"
            label={layout === "slider" ? "عدد الكروت الظاهرة" : "عدد أعمدة الشبكة"}
            value={config.density}
          />
        </div>
        <div className={layout === "slider" ? "contents" : "hidden"}>
            <SwitchField name="latest_show_arrows" label="إظهار الأسهم" defaultChecked={config.showArrows} />
            <SwitchField name="latest_show_dots" label="إظهار النقاط" defaultChecked={config.showDots} />
        </div>
      </ModuleEditorFieldGrid>
      <ListSettings feedType="latest" list={config.list} visible={layout === "list"} />
    </VariantPanel>
  );
}

function StaticFields({
  feedType,
  activeFeedType,
  config,
}: {
  feedType: "popular" | "categories";
  activeFeedType: TopicsFeedType;
  config: FeedPresentationVariants["popular"] | FeedPresentationVariants["categories"];
}) {
  const [layout, setLayout] = useState<"list" | "grid">(config.layout);
  return (
    <VariantPanel feedType={feedType} activeFeedType={activeFeedType}>
      <ModuleEditorFieldGrid>
        <ModuleEditorField nature="standard" span={4}>
          <AdminFormListboxSelect
            name={`${feedType}_layout`}
            label="النمط"
            value={layout}
            onChange={(value) => setLayout(value as "list" | "grid")}
            options={STATIC_LAYOUT_OPTIONS}
          />
        </ModuleEditorField>
        <div className={layout === "grid" ? "contents" : "hidden"}>
          <DensityField
            name={`${feedType}_columns`}
            label="عدد أعمدة الشبكة"
            value={config.columns}
          />
        </div>
      </ModuleEditorFieldGrid>
      <ListSettings feedType={feedType} list={config.list} visible={layout === "list"} />
    </VariantPanel>
  );
}

function SeriesFields({
  activeFeedType,
  config,
}: {
  activeFeedType: TopicsFeedType;
  config: FeedPresentationVariants["series"];
}) {
  const [layout, setLayout] = useState<FeedPresentationLayout>(config.layout);
  return (
    <VariantPanel feedType="series" activeFeedType={activeFeedType}>
      <ModuleEditorFieldGrid>
        <ModuleEditorField nature="standard" span={4}>
          <AdminFormListboxSelect
            name="series_layout"
            label="النمط"
            value={layout}
            onChange={(value) => setLayout(value as FeedPresentationLayout)}
            options={ALL_LAYOUT_OPTIONS}
          />
        </ModuleEditorField>
        <div className={layout === "grid" ? "contents" : "hidden"}>
          <DensityField name="series_columns" label="عدد أعمدة الشبكة" value={config.columns} />
        </div>
        <div className={layout === "slider" ? "contents" : "hidden"}>
          <SwitchField name="series_show_arrows" label="إظهار الأسهم" defaultChecked={config.showArrows} />
        </div>
      </ModuleEditorFieldGrid>
      <ListSettings feedType="series" list={config.list} visible={layout === "list"} />
    </VariantPanel>
  );
}

export default function FeedPresentationVariantFields({
  activeFeedType,
  variants,
  limit,
  maxLimit,
}: {
  activeFeedType: TopicsFeedType;
  variants: FeedPresentationVariants;
  limit: number;
  maxLimit: number;
}) {
  return (
    <div
      className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-black/15 p-4"
      data-feed-presentation-controls=""
      data-feed-presentation-active-type={activeFeedType}
    >
      <ModuleEditorSectionHeading intent="settings">شكل العرض</ModuleEditorSectionHeading>
      <ModuleEditorFieldGrid>
        <NumberField
          name="limit"
          label="عدد العناصر المعروضة"
          defaultValue={limit}
          max={maxLimit}
        />
      </ModuleEditorFieldGrid>
      <LatestFields activeFeedType={activeFeedType} config={variants.latest} />
      <StaticFields feedType="popular" activeFeedType={activeFeedType} config={variants.popular} />
      <StaticFields feedType="categories" activeFeedType={activeFeedType} config={variants.categories} />
      <SeriesFields activeFeedType={activeFeedType} config={variants.series} />
    </div>
  );
}
