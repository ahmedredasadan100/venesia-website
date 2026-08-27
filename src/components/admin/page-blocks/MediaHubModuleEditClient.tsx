"use client";

import { useState } from "react";

import { AdminFormListboxSelect, AdminFormSwitch } from "../ui";
import {
  ModuleEditorFeedback,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorHeader,
  ModuleEditorIdentitySection,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorTabs,
  ModuleEditorVisibilityAlignRow,
} from "./ModuleEditorPresentation";
import {
  CollectionItemLimitField,
  CollectionPresentationFields,
} from "./CollectionModuleFields";
import type { Json } from "../../../lib/database.types";
import { MEDIA_HUB_SECTION_LABELS } from "../../../lib/media-hub-modules/admin-present";
import {
  MEDIA_HUB_SECTION_DEFAULTS,
  parseMediaHubModuleConfig,
  parseMediaHubSectionKey,
  type MediaHubMediaType,
  type MediaListingPresentationConfig,
} from "../../../lib/media-hub-modules/parse-config";
import type { MediaHubSectionKey } from "../../../lib/media-hub-modules/types";
import { getMediaHubCollectionCapabilities } from "../../../lib/media-hub-modules/presentation-contract";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";
import { resolvePageBlockTextFormat } from "../../../lib/page-blocks/configs";

type MediaHubModuleEditClientProps = {
  block: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    section_key: string;
    config: Json;
  };
  assignmentContext: ModuleAssignmentContext;
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

const SECTION_KEYS = Object.keys(MEDIA_HUB_SECTION_LABELS) as MediaHubSectionKey[];
const MEDIA_TYPE_LABELS: Record<MediaHubMediaType, string> = {
  news: "أخبار",
  video: "فيديوهات",
  gallery: "معرض الصور",
  press: "بيانات صحفية",
  site_update: "تحديثات الموقع",
};

function readInitialSectionKey(value: string): MediaHubSectionKey {
  try {
    return parseMediaHubSectionKey(value);
  } catch {
    return "featured";
  }
}

function ListingPresentationFields({
  config,
  mediaType,
}: {
  config: MediaListingPresentationConfig;
  mediaType: MediaHubMediaType;
}) {
  const [layout, setLayout] = useState(config.layout);

  return (
    <>
      <input type="hidden" name="placement" value="listing" />
      <input type="hidden" name="media_type" value={mediaType} />

      <ModuleEditorField nature="standard" span={4}>
        <div className="space-y-2">
          <span className="block text-sm font-medium text-white/70">نوع المحتوى</span>
          <p className="rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/60">
            {MEDIA_TYPE_LABELS[mediaType]}
          </p>
        </div>
      </ModuleEditorField>

      <ModuleEditorField nature="standard" span={3}>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">عدد العناصر في الصفحة</span>
          <input
            name="page_size"
            type="number"
            min={1}
            max={60}
            defaultValue={config.pageSize}
            required
            className={fieldClassName()}
            dir="ltr"
          />
        </label>
      </ModuleEditorField>

      <ModuleEditorField nature="standard" span={3}>
        <AdminFormListboxSelect
          name="listing_layout"
          label="تخطيط القائمة"
          value={layout}
          onChange={(value) => setLayout(value === "vertical" ? "vertical" : "grid")}
          options={[
            { value: "grid", label: "شبكة" },
            { value: "vertical", label: "رأسي" },
          ]}
        />
      </ModuleEditorField>

      {layout === "grid" ? (
        <ModuleEditorField nature="standard" span={3}>
          <AdminFormListboxSelect
            name="listing_columns"
            label="عدد الأعمدة"
            defaultValue={String(config.columns)}
            options={[
              { value: "1", label: "عمود واحد" },
              { value: "2", label: "عمودان" },
              { value: "3", label: "ثلاثة أعمدة" },
            ]}
          />
        </ModuleEditorField>
      ) : (
        <input type="hidden" name="listing_columns" value={config.columns} />
      )}

      <ModuleEditorField nature="standard" span={3}>
        <AdminFormListboxSelect
          name="card_variant"
          label="شكل الكروت"
          defaultValue={config.cardVariant}
          options={[
            { value: "default", label: "افتراضي" },
            { value: "compact", label: "مدمج" },
          ]}
        />
      </ModuleEditorField>

      <ModuleEditorField nature="standard" span={4}>
        <AdminFormSwitch
          name="pagination_enabled"
          label="تفعيل Pagination"
          defaultChecked={config.paginationEnabled}
          value="true"
          uncheckedValue="false"
          surface
        />
      </ModuleEditorField>

      <ModuleEditorField nature="short-text" span={4}>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">CTA للكروت</span>
          <input
            name="card_cta_text"
            defaultValue={config.cardCtaText}
            required
            className={fieldClassName()}
          />
        </label>
      </ModuleEditorField>
    </>
  );
}

export default function MediaHubModuleEditClient({
  block,
  assignmentContext,
  saved,
  updateAction,
}: MediaHubModuleEditClientProps) {
  const initialSectionKey = readInitialSectionKey(block.section_key);
  const parsedInitial = parseMediaHubModuleConfig(block.config ?? {}, initialSectionKey);
  const isListing = parsedInitial.placement === "listing" && Boolean(parsedInitial.listing && parsedInitial.type);
  const isDedicatedFeatured = parsedInitial.placement === "featured";

  const [sectionKey, setSectionKey] = useState<MediaHubSectionKey>(initialSectionKey);
  const [mediaType, setMediaType] = useState<MediaHubMediaType>(parsedInitial.type ?? "news");
  const [eyebrow, setEyebrow] = useState(parsedInitial.presentation.eyebrow);
  const [title, setTitle] = useState(parsedInitial.presentation.title);
  const [description, setDescription] = useState(parsedInitial.presentation.description);
  const [ctaText, setCtaText] = useState(parsedInitial.presentation.ctaText);
  const eyebrowFormat = resolvePageBlockTextFormat(parsedInitial.presentation, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(parsedInitial.presentation, "title", { bold: true });
  const descriptionFormat = resolvePageBlockTextFormat(parsedInitial.presentation, "description");
  function handleSectionChange(nextSectionKey: MediaHubSectionKey) {
    setSectionKey(nextSectionKey);
    const nextPresentation = MEDIA_HUB_SECTION_DEFAULTS[nextSectionKey].config.presentation;
    setEyebrow(nextPresentation.eyebrow);
    setTitle(nextPresentation.title);
    setDescription(nextPresentation.description);
    setCtaText(nextPresentation.ctaText);

    if (nextSectionKey === "featured") setMediaType("news");
  }

  const activeConfig = sectionKey === initialSectionKey
    ? parsedInitial
    : MEDIA_HUB_SECTION_DEFAULTS[sectionKey].config;
  const activeCapabilities = getMediaHubCollectionCapabilities(sectionKey);
  const activeHierarchy = activeConfig.contentHierarchy ?? activeCapabilities.hierarchy.defaults;
  const activeCollectionView = activeConfig.presentation.collectionView;
  const activeItemLimit = activeConfig.itemLimit
    ?? MEDIA_HUB_SECTION_DEFAULTS[sectionKey].defaultLimit
    ?? 4;

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <ModuleEditorHeader
        moduleKind="media-hub"
        entityName={block.name}
        backHref="/admin/pages-blocks/blocks/media-hub"
        backLabel="الرجوع لكل موديولات المركز الإعلامي"
        status={block.status}
        saved={saved}
      />

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />
        <input type="hidden" name="description" value={block.description ?? ""} />
        <input type="hidden" name="data_source" value="topics" />
        {!isListing ? <input type="hidden" name="placement" value={parsedInitial.placement} /> : null}
        {isListing || isDedicatedFeatured ? (
          <input type="hidden" name="section_key" value={initialSectionKey} />
        ) : null}

        {isListing ? (
          <>
            <input type="hidden" name="eyebrow" value={eyebrow} />
            <input type="hidden" name="title" value={title} />
            <input type="hidden" name="presentation_description" value={description} />
            <input type="hidden" name="cta_text" value={ctaText} />
            <input type="hidden" name="show_eyebrow" value={String(eyebrowFormat.visible)} />
            <input type="hidden" name="eyebrow_bold" value={String(eyebrowFormat.bold)} />
            <input type="hidden" name="eyebrow_alignment" value={eyebrowFormat.alignment} />
            <input type="hidden" name="show_title" value={String(titleFormat.visible)} />
            <input type="hidden" name="title_bold" value={String(titleFormat.bold)} />
            <input type="hidden" name="title_alignment" value={titleFormat.alignment} />
            <input type="hidden" name="show_description" value={String(descriptionFormat.visible)} />
            <input type="hidden" name="description_bold" value={String(descriptionFormat.bold)} />
            <input type="hidden" name="description_alignment" value={descriptionFormat.alignment} />
          </>
        ) : null}

        <ModuleEditorIdentitySection
          name={block.name}
          status={block.status}
          inputClassName={fieldClassName("h-11")}
        >
          {isListing || isDedicatedFeatured ? (
            <div className="space-y-2">
              <span className="block text-sm font-medium text-white/70">نوع السكشن</span>
              <div className="flex h-11 items-center rounded-2xl border border-white/10 bg-[#05070B] px-4 text-sm text-white/70">
                {MEDIA_HUB_SECTION_LABELS[initialSectionKey]}
              </div>
            </div>
          ) : (
            <AdminFormListboxSelect
              name="section_key"
              label="نوع السكشن"
              value={sectionKey}
              onChange={(value) => handleSectionChange(readInitialSectionKey(value))}
              options={SECTION_KEYS.map((key) => ({
                value: key,
                label: MEDIA_HUB_SECTION_LABELS[key],
              }))}
            />
          )}
        </ModuleEditorIdentitySection>

        <ModuleEditorTabs
          moduleKind="media-hub"
          activePanelContext={
            <ModuleEditorFeedback backHref="/admin/pages-blocks/blocks/media-hub" saved={saved} />
          }
          tabs={[
            {
              id: "content",
              content: (
                isListing && parsedInitial.listing && parsedInitial.type ? (
                  <ModuleEditorSection>
                    <ModuleEditorFieldGrid>
                      <ListingPresentationFields
                        config={parsedInitial.listing}
                        mediaType={parsedInitial.type}
                      />
                    </ModuleEditorFieldGrid>
                  </ModuleEditorSection>
                ) : (
                  <div className="space-y-5">
                    <ModuleEditorSection>
                      <ModuleEditorSectionHeading intent="domain">
                        محتوى السكشن
                      </ModuleEditorSectionHeading>
                      <ModuleEditorFieldGrid className="mt-4">
                        <ModuleEditorField nature="short-text" span={4}>
                          <ModuleEditorVisibilityAlignRow label="النص التمهيدي" showName="show_eyebrow" boldName="eyebrow_bold" alignmentName="eyebrow_alignment" showDefault={eyebrowFormat.visible} boldDefault={eyebrowFormat.bold} alignmentDefault={eyebrowFormat.alignment}>
                            <input
                              name="eyebrow"
                              aria-label="النص التمهيدي"
                              value={eyebrow}
                              onChange={(event) => setEyebrow(event.target.value)}
                              className={fieldClassName()}
                            />
                          </ModuleEditorVisibilityAlignRow>
                        </ModuleEditorField>

                        <ModuleEditorField nature="short-text" span={4}>
                          <ModuleEditorVisibilityAlignRow label="عنوان السكشن" showName="show_title" boldName="title_bold" alignmentName="title_alignment" showDefault={titleFormat.visible} boldDefault={titleFormat.bold} alignmentDefault={titleFormat.alignment}>
                            <input
                              name="title"
                              aria-label="عنوان السكشن"
                              value={title}
                              onChange={(event) => setTitle(event.target.value)}
                              className={fieldClassName()}
                            />
                          </ModuleEditorVisibilityAlignRow>
                        </ModuleEditorField>

                        <ModuleEditorField nature="short-description" span={4}>
                          <ModuleEditorVisibilityAlignRow label="وصف السكشن" showName="show_description" boldName="description_bold" alignmentName="description_alignment" showDefault={descriptionFormat.visible} boldDefault={descriptionFormat.bold} alignmentDefault={descriptionFormat.alignment}>
                            <textarea
                              name="presentation_description"
                              aria-label="وصف السكشن"
                              value={description}
                              onChange={(event) => setDescription(event.target.value)}
                              rows={2}
                              className={fieldClassName("h-[72px] resize-none overflow-hidden leading-6")}
                            />
                          </ModuleEditorVisibilityAlignRow>
                        </ModuleEditorField>

                        <ModuleEditorField nature="short-text" span={3}>
                          <label className="block space-y-2">
                            <span className="text-xs font-semibold text-white/55">نص زر الاستكشاف</span>
                            <input
                              name="cta_text"
                              value={ctaText}
                              onChange={(event) => setCtaText(event.target.value)}
                              className={fieldClassName()}
                            />
                          </label>
                        </ModuleEditorField>

                        {sectionKey === "featured" ? (
                          <ModuleEditorField nature="standard" span={4}>
                            <AdminFormListboxSelect
                              name="media_type"
                              label="نوع المحتوى المميز"
                              value={mediaType}
                              onChange={(value) => setMediaType(value as MediaHubMediaType)}
                              options={(Object.keys(MEDIA_TYPE_LABELS) as MediaHubMediaType[]).map((type) => ({
                                value: type,
                                label: MEDIA_TYPE_LABELS[type],
                              }))}
                              hint="يعرض الموديول محتوى منشورًا ومميزًا من النوع المختار فقط."
                            />
                          </ModuleEditorField>
                        ) : null}
                      </ModuleEditorFieldGrid>
                    </ModuleEditorSection>

                    <ModuleEditorSection>
                      <ModuleEditorSectionHeading intent="settings">
                        تكوين عرض المحتوى
                      </ModuleEditorSectionHeading>
                      <ModuleEditorFieldGrid key={sectionKey} className="mt-4">
                        <CollectionItemLimitField value={activeItemLimit} />
                        <CollectionPresentationFields
                          hierarchy={activeHierarchy}
                          hierarchyCapabilities={activeCapabilities.hierarchy}
                          view={activeCollectionView}
                          viewCapabilities={activeCapabilities.view}
                        />
                      </ModuleEditorFieldGrid>
                    </ModuleEditorSection>
                  </div>
                )
              ),
            },
            {
              id: "pages",
              content: (
                <ModuleEditorPagesTab
                  moduleName={block.name}
                  assignmentContext={assignmentContext}
                />
              ),
            },
          ]}
        />

        <ModuleEditorSaveArea />
      </form>
    </div>
  );
}
