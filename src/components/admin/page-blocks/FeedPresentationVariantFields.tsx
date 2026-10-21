"use client";

import { useState, type ReactNode } from "react";

import type {
  FeedPresentationDensity,
  FeedPresentationLayout,
  FeedPresentationVariants,
  TopicsFeedType,
} from "../../../lib/feed-modules/types";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import { AdminCard, AdminFormControlHeader, AdminFormGrid, AdminFormListboxSelect } from "../ui";
import { AdminModuleTabIcon } from "../ui/AdminModuleTabs";
import AdminFormSwitch from "../ui/AdminFormSwitch";

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
      className={active ? "contents" : "hidden"}
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
  description,
  min = 1,
  max,
}: {
  name: string;
  label: string;
  defaultValue: number;
  description?: string;
  min?: number;
  max?: number;
}) {
  return (
    <AdminCard presentation="premium" className="h-full p-3">
      <label className="flex h-full min-w-0 flex-col gap-3">
        <AdminFormControlHeader
          title={label}
          description={description ? <span id={`${name}-description`}>{description}</span> : undefined}
          icon={<AdminModuleTabIcon name="specifications" />}
          presentation="leading-icon"
        />
        <input
          name={name}
          aria-label={label}
          aria-describedby={description ? `${name}-description` : undefined}
          type="number"
          min={min}
          max={max}
          defaultValue={defaultValue}
          className={fieldClassName("mt-auto")}
        />
      </label>
    </AdminCard>
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
    <AdminCard presentation="premium" className="h-full p-3">
      <AdminFormListboxSelect
        sizing="full"
        name={name}
        label={<AdminFormControlHeader title={label} icon={<AdminModuleTabIcon name="overview" />} presentation="leading-icon" />}
        className="flex h-full flex-col justify-between"
        defaultValue={String(value)}
        options={DENSITY_OPTIONS}
      />
    </AdminCard>
  );
}

function SwitchField({
  name,
  label,
  defaultChecked,
  description,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  description?: string;
}) {
  return (
    <AdminCard presentation="premium" className="h-full p-3">
      <AdminFormSwitch
        embedded
        name={name}
        label={
          <AdminFormControlHeader
            presentation="leading-icon"
            icon={<AdminModuleTabIcon name="settings" />}
            description={description ? <span id={`${name}-description`} aria-hidden="true">{description}</span> : undefined}
            title={label}
          />
        }
        defaultChecked={defaultChecked}
        describedBy={description ? `${name}-description` : undefined}
        uncheckedValue="false"
        value="true"
      />
    </AdminCard>
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
    <div className={visible ? "contents" : "hidden"} data-feed-list-settings-for={feedType}>
      <>
        <NumberField
          name={`${feedType}_list_items_per_group`}
          label="عدد العناصر في المجموعة"
          description="عدد العناصر التي تظهر معًا داخل مجموعة القائمة."
          defaultValue={list.itemsPerGroup}
        />
        <SwitchField
          name={`${feedType}_list_show_dots`}
          label="إظهار مؤشرات التنقل"
          description="عرض نقاط التنقل بين مجموعات القائمة."
          defaultChecked={list.showDots}
        />
        <NumberField
          name={`${feedType}_list_interval_seconds`}
          label="مدة الانتقال بالثواني"
          description="الفاصل الزمني بين مجموعات القائمة بالثواني."
          defaultValue={list.intervalSeconds}
          min={3}
          max={60}
        />
      </>
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
      <>
        <AdminCard presentation="premium" className="h-full p-3">
          <AdminFormListboxSelect
            sizing="full"
            name="latest_layout"
            label={<AdminFormControlHeader title="النمط" description="اختر طريقة عرض عناصر المحتوى." icon={<AdminModuleTabIcon name="section" />} presentation="leading-icon" />}
            className="flex h-full flex-col justify-between"
            value={layout}
            onChange={(value) => setLayout(value as FeedPresentationLayout)}
            options={ALL_LAYOUT_OPTIONS}
          />
        </AdminCard>
        <div className={layout !== "list" ? "contents" : "hidden"}>
          <DensityField
            name="latest_density"
            label={layout === "slider" ? "عدد الكروت الظاهرة" : "عدد أعمدة الشبكة"}
            value={config.density}
          />
        </div>
        <div className={layout === "slider" ? "contents" : "hidden"}>
          <SwitchField name="latest_show_arrows" label="إظهار الأسهم" description="عرض أزرار التنقل بين الشرائح." defaultChecked={config.showArrows} />
          <SwitchField name="latest_show_dots" label="إظهار النقاط" description="عرض نقاط التنقل بين شرائح المحتوى." defaultChecked={config.showDots} />
        </div>
      </>
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
      <>
        <AdminCard presentation="premium" className="h-full p-3">
          <AdminFormListboxSelect
            sizing="full"
            name={`${feedType}_layout`}
            label={<AdminFormControlHeader title="النمط" description="اختر طريقة عرض عناصر المحتوى." icon={<AdminModuleTabIcon name="section" />} presentation="leading-icon" />}
            className="flex h-full flex-col justify-between"
            value={layout}
            onChange={(value) => setLayout(value as "list" | "grid")}
            options={STATIC_LAYOUT_OPTIONS}
          />
        </AdminCard>
        <div className={layout === "grid" ? "contents" : "hidden"}>
          <DensityField
            name={`${feedType}_columns`}
            label="عدد أعمدة الشبكة"
            value={config.columns}
          />
        </div>
      </>
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
      <>
        <AdminCard presentation="premium" className="h-full p-3">
          <AdminFormListboxSelect
            sizing="full"
            name="series_layout"
            label={<AdminFormControlHeader title="النمط" description="اختر طريقة عرض عناصر المحتوى." icon={<AdminModuleTabIcon name="section" />} presentation="leading-icon" />}
            className="flex h-full flex-col justify-between"
            value={layout}
            onChange={(value) => setLayout(value as FeedPresentationLayout)}
            options={ALL_LAYOUT_OPTIONS}
          />
        </AdminCard>
        <div className={layout === "grid" ? "contents" : "hidden"}>
          <DensityField name="series_columns" label="عدد أعمدة الشبكة" value={config.columns} />
        </div>
        <div className={layout === "slider" ? "contents" : "hidden"}>
          <SwitchField name="series_show_arrows" label="إظهار الأسهم" defaultChecked={config.showArrows} />
        </div>
      </>
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
      data-feed-presentation-controls=""
      data-feed-presentation-active-type={activeFeedType}
    >
      <AdminFormGrid columns={3}>
        <NumberField
          name="limit"
          label="عدد العناصر المعروضة"
          description="إجمالي العناصر المسترجعة للعرض."
          defaultValue={limit}
          max={maxLimit}
        />
        <LatestFields activeFeedType={activeFeedType} config={variants.latest} />
        <StaticFields feedType="popular" activeFeedType={activeFeedType} config={variants.popular} />
        <StaticFields feedType="categories" activeFeedType={activeFeedType} config={variants.categories} />
        <SeriesFields activeFeedType={activeFeedType} config={variants.series} />
      </AdminFormGrid>
    </div>
  );
}
