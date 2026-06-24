"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import AdminModuleTabs from "./AdminModuleTabs";
import ModulePageAssignmentsField from "./ModulePageAssignmentsField";
import { fieldClassName, statusMeta } from "../../../lib/page-blocks/admin-utils";
import {
  getMediaHubModuleSummary,
  MEDIA_HUB_SECTION_LABELS,
} from "../../../lib/media-hub-modules/admin-present";
import {
  MEDIA_HUB_SECTION_DEFAULTS,
  parseMediaHubModuleConfig,
  parseMediaHubSectionKey,
} from "../../../lib/media-hub-modules/parse-config";
import type { MediaHubSectionKey } from "../../../lib/media-hub-modules/types";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";

type MediaHubModuleEditClientProps = {
  block: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    section_key: string;
    config: Record<string, unknown>;
  };
  assignmentContext: ModuleAssignmentContext;
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

const SECTION_KEYS = Object.keys(MEDIA_HUB_SECTION_LABELS) as MediaHubSectionKey[];

function readInitialSectionKey(value: string): MediaHubSectionKey {
  try {
    return parseMediaHubSectionKey(value);
  } catch {
    return "featured";
  }
}

export default function MediaHubModuleEditClient({
  block,
  assignmentContext,
  saved,
  updateAction,
}: MediaHubModuleEditClientProps) {
  const initialSectionKey = readInitialSectionKey(block.section_key);
  const initialConfig = block.config ?? {};
  const parsedInitial = parseMediaHubModuleConfig(initialConfig, initialSectionKey);

  const [sectionKey, setSectionKey] = useState<MediaHubSectionKey>(initialSectionKey);
  const [dataSource, setDataSource] = useState<"media_items">("media_items");
  const [limit, setLimit] = useState<number | "">(
    typeof parsedInitial.limit === "number" ? parsedInitial.limit : MEDIA_HUB_SECTION_DEFAULTS[initialSectionKey].defaultLimit ?? "",
  );
  const [sideLimit, setSideLimit] = useState<number | "">(
    typeof parsedInitial.sideLimit === "number" ? parsedInitial.sideLimit : MEDIA_HUB_SECTION_DEFAULTS.featured.defaultSideLimit ?? "",
  );
  const [listLimit, setListLimit] = useState<number | "">(
    typeof parsedInitial.listLimit === "number" ? parsedInitial.listLimit : MEDIA_HUB_SECTION_DEFAULTS.featured.defaultListLimit ?? "",
  );

  const status = statusMeta(block.status);
  const assignedPageIds = assignmentContext.assignments.map((row) => row.page_id);
  const summary = useMemo(
    () => getMediaHubModuleSummary(sectionKey, block.description),
    [sectionKey, block.description],
  );

  function handleSectionChange(nextSectionKey: MediaHubSectionKey) {
    setSectionKey(nextSectionKey);
    setDataSource("media_items");

    if (nextSectionKey === "featured") {
      setSideLimit(MEDIA_HUB_SECTION_DEFAULTS.featured.defaultSideLimit ?? 3);
      setListLimit(MEDIA_HUB_SECTION_DEFAULTS.featured.defaultListLimit ?? 4);
      setLimit("");
      return;
    }

    setLimit(MEDIA_HUB_SECTION_DEFAULTS[nextSectionKey].defaultLimit ?? "");
    setSideLimit("");
    setListLimit("");
  }

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <section className="rounded-[34px] border border-white/10 bg-[#080B10]/78 p-6 shadow-[0_30px_110px_rgba(0,0,0,0.26)] backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/admin/pages-blocks/blocks/media-hub"
              className="mb-4 inline-flex items-center gap-2 text-sm text-white/45 hover:text-[#D8B87A]"
            >
              <span aria-hidden="true">→</span>
              الرجوع لكل Media Hub Modules
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">Media Hub Module</p>
            <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">{block.name}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/56">
              عدّل نوع السكشن ومصدر البيانات و Limit — التغييرات تُحفظ في DB وتُطبَّق على Public Hub.
            </p>
            {saved ? <p className="mt-3 text-sm text-emerald-300">تم حفظ الموديول بنجاح.</p> : null}
          </div>

          <span
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              status.tone === "green"
                ? "bg-emerald-500/10 text-emerald-300"
                : status.tone === "gold"
                  ? "bg-[#D8B87A]/10 text-[#D8B87A]"
                  : "bg-white/10 text-white/45"
            }`}
          >
            {status.label}
          </span>
        </div>
      </section>

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />

        <AdminModuleTabs
          tabs={[
            {
              id: "content",
              label: "إعدادات الموديول",
              content: (
                <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">اسم الموديول</span>
                    <input name="name" defaultValue={block.name} required className={fieldClassName()} />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">نوع السكشن</span>
                    <select
                      name="section_key"
                      value={sectionKey}
                      onChange={(event) => handleSectionChange(readInitialSectionKey(event.target.value))}
                      className={fieldClassName()}
                    >
                      {SECTION_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {MEDIA_HUB_SECTION_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">مصدر البيانات</span>
                    <select
                      name="data_source"
                      value={dataSource}
                      onChange={() => setDataSource("media_items")}
                      className={fieldClassName()}
                      dir="ltr"
                    >
                      <option value="media_items">media_items — عناصر المركز الإعلامي</option>
                    </select>
                  </label>

                  {sectionKey === "featured" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-white/55">Featured limit — قائمة الأخبار</span>
                        <input
                          name="list_limit"
                          type="number"
                          min={1}
                          value={listLimit}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            setListLimit(Number.isFinite(next) && next > 0 ? next : "");
                          }}
                          required
                          className={fieldClassName()}
                          dir="ltr"
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-white/55">Side carousel limit — جانبي</span>
                        <input
                          name="side_limit"
                          type="number"
                          min={1}
                          value={sideLimit}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            setSideLimit(Number.isFinite(next) && next > 0 ? next : "");
                          }}
                          required
                          className={fieldClassName()}
                          dir="ltr"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Limit</span>
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
                  )}

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">وصف قصير</span>
                    <textarea
                      readOnly
                      value={summary}
                      rows={3}
                      className={fieldClassName("cursor-default resize-none text-white/72")}
                    />
                  </label>
                </section>
              ),
            },
            {
              id: "settings",
              label: "الإعدادات",
              content: (
                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                  <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                    <h2 className="text-lg font-semibold text-white">بيانات الموديول</h2>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">وصف داخلي</span>
                      <input name="description" defaultValue={block.description ?? ""} className={fieldClassName()} />
                    </label>
                  </section>

                  <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                    <h2 className="text-lg font-semibold text-white">حالة النشر</h2>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">حالة الموديول</span>
                      <select name="status" defaultValue={block.status} className={fieldClassName()}>
                        <option value="draft">مسودة</option>
                        <option value="published">منشور</option>
                        <option value="unpublished">مخفي</option>
                        <option value="archived">أرشيف</option>
                      </select>
                    </label>
                    <p className="text-xs leading-6 text-white/42">
                      Slot و Sort Order و Visibility تُدار من Pages Manager لكل صفحة على حدة.
                    </p>
                  </section>
                </div>
              ),
            },
            {
              id: "pages",
              label: "يظهر في الصفحات",
              content: (
                <ModulePageAssignmentsField
                  pages={assignmentContext.pages}
                  assignedPageIds={assignedPageIds}
                />
              ),
            },
          ]}
        />

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="rounded-2xl bg-[#D8B87A] px-6 py-3 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d]"
          >
            حفظ الموديول
          </button>
        </div>
      </form>
    </div>
  );
}
