"use client";

import { useMemo, useRef, useState } from "react";

import type {
  ProjectEntryRoot,
  ProjectLocationOption,
} from "../../../../lib/admin/projects/project-entry-contract";
import {
  ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME,
  AdminFormListboxSelect,
  adminFormFieldClassName,
  adminFormHintClassName,
  adminFormLabelClassName,
} from "../../ui";
import {
  AdminFormError,
  useOptionalAdminFormRuntime,
} from "../../ui/AdminFormRuntime";

function parseMapCoordinates(value: string) {
  const atMatch = value.match(
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)z/i,
  );
  if (atMatch) {
    return {
      latitude: atMatch[1] ?? "",
      longitude: atMatch[2] ?? "",
      zoom: String(Math.max(1, Math.min(22, Math.round(Number(atMatch[3]))))),
    };
  }
  const placeMatch = value.match(
    /\/maps\/place\/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\/|$|[?#])/i,
  );
  if (placeMatch) {
    return {
      latitude: placeMatch[1] ?? "",
      longitude: placeMatch[2] ?? "",
      zoom: "16",
    };
  }
  try {
    const url = new URL(value);
    const query = url.searchParams.get("q") ?? url.searchParams.get("query") ?? "";
    const queryMatch = query.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (queryMatch) {
      return {
        latitude: queryMatch[1] ?? "",
        longitude: queryMatch[2] ?? "",
        zoom: "16",
      };
    }
  } catch {
    return null;
  }
  return null;
}

function optionLabel(option: ProjectLocationOption) {
  const label = option.nameEn
    ? `${option.nameAr} — ${option.nameEn}`
    : option.nameAr;
  return option.isActive ? label : `${label} — غير نشط`;
}

function listboxOptions(options: ProjectLocationOption[]) {
  return options.map((option) => ({
    value: String(option.id),
    label: optionLabel(option),
    disabled: !option.isActive,
  }));
}

export default function ProjectLocationEditor({
  project,
  locations,
  schemaReady,
  schemaMessage,
}: {
  project: ProjectEntryRoot;
  locations: ProjectLocationOption[];
  schemaReady: boolean;
  schemaMessage: string | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const runtime = useOptionalAdminFormRuntime();
  const fieldError = (field: string) => runtime?.fieldErrors[field]?.[0] ?? null;
  const hasError = (field: string) => Boolean(fieldError(field));
  const [governorateId, setGovernorateId] = useState(project.governorate_id ?? 0);
  const [cityId, setCityId] = useState(project.city_id ?? 0);
  const [mainAreaId, setMainAreaId] = useState(project.main_area_id ?? 0);
  const [subAreaId, setSubAreaId] = useState(project.sub_area_id ?? 0);
  const [mapUrl, setMapUrl] = useState(project.google_maps_url);
  const [latitude, setLatitude] = useState(project.latitude);
  const [longitude, setLongitude] = useState(project.longitude);
  const [zoom, setZoom] = useState(project.map_zoom || "16");
  const [mapMessage, setMapMessage] = useState<string | null>(null);
  const numericLatitude = Number(latitude);
  const numericLongitude = Number(longitude);
  const numericZoom = Number(zoom);
  const hasPreviewCoordinates =
    latitude.trim() !== "" &&
    longitude.trim() !== "" &&
    Number.isFinite(numericLatitude) &&
    numericLatitude >= -90 &&
    numericLatitude <= 90 &&
    Number.isFinite(numericLongitude) &&
    numericLongitude >= -180 &&
    numericLongitude <= 180;
  const mapEmbedUrl = hasPreviewCoordinates
    ? `https://maps.google.com/maps?q=${encodeURIComponent(`${numericLatitude},${numericLongitude}`)}&z=${Number.isFinite(numericZoom) ? Math.max(1, Math.min(22, Math.round(numericZoom))) : 16}&output=embed`
    : null;

  const governorates = useMemo(
    () => locations.filter((option) => option.level === "governorate"),
    [locations],
  );
  const cities = useMemo(
    () =>
      locations.filter(
        (option) => option.level === "city" && option.parentId === governorateId,
      ),
    [governorateId, locations],
  );
  const mainAreas = useMemo(
    () =>
      locations.filter(
        (option) => option.level === "main_area" && option.parentId === cityId,
      ),
    [cityId, locations],
  );
  const subAreas = useMemo(
    () =>
      locations.filter(
        (option) => option.level === "sub_area" && option.parentId === mainAreaId,
      ),
    [locations, mainAreaId],
  );
  const governorateOptions = useMemo(
    () => listboxOptions(governorates),
    [governorates],
  );
  const cityOptions = useMemo(() => listboxOptions(cities), [cities]);
  const mainAreaOptions = useMemo(() => listboxOptions(mainAreas), [mainAreas]);
  const subAreaOptions = useMemo(() => listboxOptions(subAreas), [subAreas]);

  function notifyMutation() {
    rootRef.current
      ?.closest("form")
      ?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function extractCoordinates() {
    const coordinates = parseMapCoordinates(mapUrl.trim());
    if (!coordinates) {
      setMapMessage(
        "تعذر استخراج الإحداثيات من الرابط. أدخل خط العرض وخط الطول يدويًا.",
      );
      return;
    }
    setLatitude(coordinates.latitude);
    setLongitude(coordinates.longitude);
    setZoom(coordinates.zoom);
    setMapMessage("تم استخراج الإحداثيات. راجعها قبل الحفظ.");
    queueMicrotask(notifyMutation);
  }

  return (
    <div
      ref={rootRef}
      dir="rtl"
      className="space-y-5"
      data-project-location-cascade
    >
      {!schemaReady ? (
        <div
          className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-7 text-amber-100"
          role="status"
        >
          {schemaMessage ??
            "ترحيل قاعدة البيانات الجديد غير مطبق، لذلك لا تتوفر شجرة المواقع بعد."}
        </div>
      ) : locations.length === 0 ? (
        <div
          className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm leading-7 text-sky-100"
          role="status"
        >
          شجرة المواقع جاهزة لكنها لا تحتوي سجلات بعد. أضف سجلات المواقع في
          بيئة البيانات المعتمدة قبل إنشاء المشروع.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminFormListboxSelect
          name="governorate_id"
          focusTargetId="governorate_id"
          label="المحافظة"
          value={governorateId ? String(governorateId) : ""}
          options={governorateOptions}
          placeholder="اختر المحافظة"
          searchPlaceholder="ابحث في المحافظات"
          searchable={governorateOptions.length > 7}
          required
          disabled={!schemaReady || governorateOptions.length === 0}
          error={fieldError("governorate_id")}
          emptyMessage="لا توجد محافظات متاحة."
          dir="rtl"
          onChange={(value) => {
            setGovernorateId(Number(value) || 0);
            setCityId(0);
            setMainAreaId(0);
            setSubAreaId(0);
          }}
        />

        <AdminFormListboxSelect
          name="city_id"
          focusTargetId="city_id"
          label="المدينة / المجتمع العمراني"
          value={cityId ? String(cityId) : ""}
          options={cityOptions}
          placeholder="اختر المدينة"
          searchPlaceholder="ابحث في المدن"
          searchable={cityOptions.length > 7}
          required
          disabled={!schemaReady || !governorateId || cityOptions.length === 0}
          error={fieldError("city_id")}
          emptyMessage={
            governorateId ? "لا توجد مدن متاحة لهذه المحافظة." : "اختر المحافظة أولًا."
          }
          dir="rtl"
          onChange={(value) => {
            setCityId(Number(value) || 0);
            setMainAreaId(0);
            setSubAreaId(0);
          }}
        />

        <AdminFormListboxSelect
          name="main_area_id"
          focusTargetId="main_area_id"
          label="المنطقة الرئيسية"
          value={mainAreaId ? String(mainAreaId) : ""}
          options={mainAreaOptions}
          placeholder="اختر المنطقة الرئيسية"
          searchPlaceholder="ابحث في المناطق الرئيسية"
          searchable={mainAreaOptions.length > 7}
          required
          disabled={!schemaReady || !cityId || mainAreaOptions.length === 0}
          error={fieldError("main_area_id")}
          emptyMessage={
            cityId ? "لا توجد مناطق رئيسية متاحة لهذه المدينة." : "اختر المدينة أولًا."
          }
          dir="rtl"
          onChange={(value) => {
            setMainAreaId(Number(value) || 0);
            setSubAreaId(0);
          }}
        />

        <AdminFormListboxSelect
          name="sub_area_id"
          focusTargetId="sub_area_id"
          label={
            <span>
              المنطقة الفرعية{" "}
              <span className="text-xs font-normal text-white/35">(اختياري)</span>
            </span>
          }
          value={subAreaId ? String(subAreaId) : ""}
          options={subAreaOptions}
          placeholder="بدون منطقة فرعية"
          searchPlaceholder="ابحث في المناطق الفرعية"
          searchable={subAreaOptions.length > 7}
          disabled={!schemaReady || !mainAreaId || subAreaOptions.length === 0}
          error={fieldError("sub_area_id")}
          emptyMessage={
            mainAreaId
              ? "لا توجد مناطق فرعية متاحة لهذه المنطقة."
              : "اختر المنطقة الرئيسية أولًا."
          }
          dir="rtl"
          onChange={(value) => setSubAreaId(Number(value) || 0)}
        />
      </div>

      <label className={adminFormLabelClassName()}>
        العنوان التفصيلي <span className="text-red-300">*</span>
        <input
          id="location_label"
          name="location_label"
          defaultValue={project.location_label}
          className={adminFormFieldClassName(
            hasError("location_label") ? "border-red-400/40" : "",
          )}
          placeholder="الشارع، الحي، المنطقة، المدينة"
          aria-invalid={hasError("location_label") || undefined}
          aria-describedby={
            hasError("location_label") ? "location_label-error" : undefined
          }
        />
        <AdminFormError name="location_label" className="text-red-300" />
      </label>

      <label className={adminFormLabelClassName()}>
        وصف الموقع
        <textarea
          id="location_description"
          name="location_description"
          defaultValue={project.location_description}
          rows={3}
          className={adminFormFieldClassName("resize-y leading-7")}
          placeholder="اكتب وصفًا موجزًا عن الموقع والمحاور المحيطة."
        />
      </label>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,1.15fr)]">
        <div className={`${ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME} space-y-4`}>
          <label className={adminFormLabelClassName()}>
            رابط خرائط جوجل <span className="text-red-300">*</span>
            <input
              id="google_maps_url"
              name="google_maps_url"
              value={mapUrl}
              onChange={(event) => setMapUrl(event.target.value)}
              dir="ltr"
              className={adminFormFieldClassName(
                `${hasError("google_maps_url") ? "border-red-400/40" : ""} text-left font-en text-xs`,
              )}
              placeholder="https://www.google.com/maps/..."
              aria-invalid={hasError("google_maps_url") || undefined}
              aria-describedby={
                hasError("google_maps_url") ? "google_maps_url-error" : undefined
              }
            />
            <AdminFormError name="google_maps_url" className="text-red-300" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={adminFormLabelClassName()}>
              خط العرض <span className="text-red-300">*</span>
              <input
                id="latitude"
                name="latitude"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                dir="ltr"
                inputMode="decimal"
                className={adminFormFieldClassName(
                  hasError("latitude") ? "border-red-400/40" : "",
                )}
                aria-invalid={hasError("latitude") || undefined}
                aria-describedby={hasError("latitude") ? "latitude-error" : undefined}
              />
              <AdminFormError name="latitude" className="text-red-300" />
            </label>
            <label className={adminFormLabelClassName()}>
              خط الطول <span className="text-red-300">*</span>
              <input
                id="longitude"
                name="longitude"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                dir="ltr"
                inputMode="decimal"
                className={adminFormFieldClassName(
                  hasError("longitude") ? "border-red-400/40" : "",
                )}
                aria-invalid={hasError("longitude") || undefined}
                aria-describedby={
                  hasError("longitude") ? "longitude-error" : undefined
                }
              />
              <AdminFormError name="longitude" className="text-red-300" />
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className={`${adminFormLabelClassName()} min-w-36 flex-1`}>
              مستوى التقريب <span className="text-red-300">*</span>
              <input
                id="map_zoom"
                name="map_zoom"
                type="number"
                min={1}
                max={22}
                value={zoom}
                onChange={(event) => setZoom(event.target.value)}
                dir="ltr"
                className={adminFormFieldClassName(
                  hasError("map_zoom") ? "border-red-400/40" : "",
                )}
                aria-invalid={hasError("map_zoom") || undefined}
                aria-describedby={hasError("map_zoom") ? "map_zoom-error" : undefined}
              />
              <AdminFormError name="map_zoom" className="text-red-300" />
            </label>
            <button
              type="button"
              onClick={extractCoordinates}
              className="min-h-11 cursor-pointer rounded-2xl bg-[#D8B87A] px-4 py-2.5 text-sm font-semibold text-[#080B10] transition hover:bg-[#E6CC98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
            >
              استخراج الإحداثيات
            </button>
            {mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-2xl border border-white/10 bg-black/25 px-4 py-2.5 text-sm font-semibold text-white/65 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
              >
                فتح خرائط جوجل
              </a>
            ) : null}
          </div>
          {mapMessage ? (
            <p className={adminFormHintClassName()} role="status">
              {mapMessage}
            </p>
          ) : null}
        </div>

        <div
          className="relative min-h-64 overflow-hidden rounded-2xl border border-white/10 bg-[#05070B]"
          aria-label="معاينة الخريطة"
        >
          {mapEmbedUrl ? (
            <iframe
              title="معاينة موقع المشروع على الخريطة"
              src={mapEmbedUrl}
              className="absolute inset-0 h-full min-h-64 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <>
              <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:28px_28px]" />
              <div className="relative flex h-full min-h-64 flex-col items-center justify-center p-5 text-center">
                <span
                  className="grid size-12 place-items-center rounded-full bg-red-500 text-xl text-white shadow-lg"
                  aria-hidden
                >
                  ●
                </span>
                <strong className="mt-4 text-base text-white/85">
                  معاينة موقع المشروع
                </strong>
                <span className="mt-2 text-xs text-white/40">
                  أدخل إحداثيات صحيحة لعرض موضعها
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
