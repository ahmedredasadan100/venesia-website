"use client";

import { useState } from "react";

import { AdminFormListboxSelect, AdminFormSwitch } from "../ui";
import {
  ModuleEditorFeedback,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorHeader,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorSettingsComposition,
  ModuleEditorStatusSwitch,
  ModuleEditorTabs,
} from "./ModuleEditorPresentation";
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
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";

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
          defaultValue={config.layout}
          options={[
            { value: "grid", label: "شبكة" },
            { value: "vertical", label: "رأسي" },
          ]}
        />
      </ModuleEditorField>

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
          hint="يطبق على تخطيط الشبكة."
        />
      </ModuleEditorField>

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
  const [limit, setLimit] = useState<number | "">(
    typeof parsedInitial.limit === "number"
      ? parsedInitial.limit
      : MEDIA_HUB_SECTION_DEFAULTS[initialSectionKey].defaultLimit ?? "",
  );
  function handleSectionChange(nextSectionKey: MediaHubSectionKey) {
    setSectionKey(nextSectionKey);
    const nextPresentation = MEDIA_HUB_SECTION_DEFAULTS[nextSectionKey].config.presentation;
    setEyebrow(nextPresentation.eyebrow);
    setTitle(nextPresentation.title);
    setDescription(nextPresentation.description);
    setCtaText(nextPresentation.ctaText);

    if (nextSectionKey === "featured") {
      setMediaType("news");
      setLimit(MEDIA_HUB_SECTION_DEFAULTS.featured.defaultLimit ?? 1);
      return;
    }

    setLimit(MEDIA_HUB_SECTION_DEFAULTS[nextSectionKey].defaultLimit ?? "");
  }

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
          </>
        ) : null}

        <ModuleEditorTabs
          moduleKind="media-hub"
          activePanelContext={
            <ModuleEditorFeedback backHref="/admin/pages-blocks/blocks/media-hub" saved={saved} />
          }
          tabs={[
            {
              id: "content",
              content: (
                <ModuleEditorSection>
                  <ModuleEditorFieldGrid>
                    <ModuleEditorField nature="standard" span={4}>
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-white/55">اسم الموديول</span>
                        <input
                          name="name"
                          defaultValue={block.name}
                          required
                          className={fieldClassName()}
                        />
                      </label>
                    </ModuleEditorField>

                    {isListing && parsedInitial.listing && parsedInitial.type ? (
                      <ListingPresentationFields
                        config={parsedInitial.listing}
                        mediaType={parsedInitial.type}
                      />
                    ) : (
                      <>
                        {isDedicatedFeatured ? (
                          <ModuleEditorField nature="standard" span={4}>
                            <div className="space-y-2">
                              <span className="block text-sm font-medium text-white/70">نوع الموديول</span>
                              <p className="rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/60">
                                {MEDIA_HUB_SECTION_LABELS.featured}
                              </p>
                            </div>
                          </ModuleEditorField>
                        ) : (
                          <ModuleEditorField nature="standard" span={4}>
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
                          </ModuleEditorField>
                        )}

                        <ModuleEditorField nature="standard" span={4}>
                          <div className="space-y-2">
                            <span className="block text-sm font-medium text-white/70">مصدر البيانات</span>
                            <p className="rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/60">
                              المحتوى الموحّد (topics)
                            </p>
                          </div>
                        </ModuleEditorField>

                        <ModuleEditorField nature="short-text" span={3}>
                          <label className="block space-y-2">
                            <span className="text-xs font-semibold text-white/55">النص التمهيدي</span>
                            <input
                              name="eyebrow"
                              value={eyebrow}
                              onChange={(event) => setEyebrow(event.target.value)}
                              className={fieldClassName()}
                            />
                          </label>
                        </ModuleEditorField>

                        <ModuleEditorField nature="short-text" span={3}>
                          <label className="block space-y-2">
                            <span className="text-xs font-semibold text-white/55">عنوان السكشن</span>
                            <input
                              name="title"
                              value={title}
                              onChange={(event) => setTitle(event.target.value)}
                              className={fieldClassName()}
                            />
                          </label>
                        </ModuleEditorField>

                        <ModuleEditorField nature="short-description" span={3}>
                          <label className="block space-y-2">
                            <span className="text-xs font-semibold text-white/55">وصف السكشن</span>
                            <input
                              name="presentation_description"
                              value={description}
                              onChange={(event) => setDescription(event.target.value)}
                              className={fieldClassName()}
                            />
                          </label>
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
                            <input type="hidden" name="limit" value="1" />
                          </ModuleEditorField>
                        ) : (
                          <ModuleEditorField nature="standard" span={4}>
                            <label className="block space-y-2">
                              <span className="text-xs font-semibold text-white/55">عدد العناصر</span>
                              <input
                                name="limit"
                                type="number"
                                min={1}
                                value={limit}
                                onChange={(event) => {
                                  const next = Number(event.target.value);
                                  setLimit(Number.isFinite(next) && next > 0 ? next : "");
                                }}
                                required
                                className={fieldClassName()}
                                dir="ltr"
                              />
                            </label>
                          </ModuleEditorField>
                        )}
                      </>
                    )}
                  </ModuleEditorFieldGrid>
                </ModuleEditorSection>
              ),
            },
            {
              id: "settings",
              content: (
                <ModuleEditorSettingsComposition
                  primary={
                    <ModuleEditorSection>
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-white/55">وصف داخلي</span>
                        <input
                          name="description"
                          defaultValue={block.description ?? ""}
                          className={fieldClassName()}
                        />
                      </label>
                    </ModuleEditorSection>
                  }
                  secondary={
                    <ModuleEditorSection>
                      <ModuleEditorSectionHeading intent="settings" className="text-lg">
                        حالة النشر
                      </ModuleEditorSectionHeading>
                      <ModuleEditorStatusSwitch status={block.status} />
                    </ModuleEditorSection>
                  }
                />
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
