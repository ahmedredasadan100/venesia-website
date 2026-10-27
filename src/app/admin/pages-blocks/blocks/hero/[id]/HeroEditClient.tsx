"use client";

import {
  AdminCard,
  ADMIN_FORM_STACK_CLASS_NAME,
  AdminFormControlHeader,
  AdminFormGrid,
} from "../../../../../../components/admin/ui";
import { AdminModuleTabIcon } from "../../../../../../components/admin/ui/AdminModuleTabs";
import { resolveHeroMediaSlot } from "../../../../../../lib/hero/hero-content-controls";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminFormRuntime from "../../../../../../components/admin/ui/AdminFormRuntime";
import { BlockEditorSaveFeedback } from "../../../../../../components/admin/page-blocks/BlockEditorContextHeader";
import AdminImagePathListField from "../../../../../../components/admin/page-blocks/AdminImagePathListField";
import {
  ModuleEditorHeader,
  ModuleEditorFeedbackSlot,
  ModuleEditorIdentitySection,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorTabs,
} from "../../../../../../components/admin/page-blocks/ModuleEditorPresentation";
import { AdminFormListboxSelect } from "../../../../../../components/admin/ui";
import { legacyHrefFromConfig } from "../../../../../../lib/admin/links/serialize";
import {
  HERO_IMAGE_COMPOSITION_OPTIONS_AR,
  PROJECT_DETAIL_HERO_ELEMENT_KEYS,
  resolveHeroContentControlsForVariant,
  resolveHeroImageCompositionPreset,
} from "../../../../../../lib/hero/hero-content-controls";
import { fieldClassName } from "../../../../../../lib/page-blocks/admin-utils";
import type { ModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import { resolveSafeInternalPath } from "../../../../../../lib/security/safe-internal-path";
import { updateHeroTemplateDetails } from "../actions";
import HeroCtaFields from "./HeroCtaFields";
import HeroElementOrderEditor from "./HeroElementOrderEditor";
import HeroTextFieldRow from "./HeroTextFieldRow";
import HeroVisibilityAlignRow from "./HeroVisibilityAlignRow";

type HeroEditClientProps = {
  hero: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    variant: string;
    style_preset: string | null;
    updated_at: string;
    status: "published" | "unpublished";
  };
  config: Record<string, unknown>;
  imagesText: string;
  mobileImagesText: string;
  variantOptions: ReadonlyArray<{ value: string; label: string }>;
  saved?: boolean;
  mediaSynchronizationWarning?: boolean;
  assignmentContext: ModuleAssignmentContext;
  initialTabId?: string;
};

type HeroRenderedAreaMetrics = {
  viewportWidth: number;
  viewportHeight: number;
  renderedWidth: number;
  renderedHeight: number;
  visibleImageWidth: number;
  visibleImageHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  visibleSourceWidth: number;
  visibleSourceHeight: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  cropLeft: number;
  objectFit: string;
  objectPosition: string;
  sourcePath: string;
};

type HeroRenderedAreaState =
  | { status: "loading" }
  | { status: "unavailable"; reason: string }
  | { status: "ready"; metrics: HeroRenderedAreaMetrics };

function roundedPixels(value: number) {
  return Math.max(0, Math.round(value));
}

function objectPositionRatio(token: string | undefined, fallback: number) {
  if (!token) return fallback;
  if (token === "left" || token === "top") return 0;
  if (token === "center") return 0.5;
  if (token === "right" || token === "bottom") return 1;
  if (token.endsWith("%")) {
    const value = Number.parseFloat(token);
    return Number.isFinite(value)
      ? Math.min(1, Math.max(0, value / 100))
      : fallback;
  }
  return fallback;
}

function originalImageSource(currentSource: string, baseHref: string) {
  try {
    const resolved = new URL(currentSource, baseHref);
    if (resolved.pathname === "/_next/image") {
      const source = resolved.searchParams.get("url");
      return source ? new URL(source, baseHref).href : resolved.href;
    }
    return resolved.href;
  } catch {
    return currentSource;
  }
}

function heroMeasurementPath(assignmentContext: ModuleAssignmentContext) {
  const assignment =
    assignmentContext.assignments.find(
      (candidate) => candidate.is_visible && candidate.page_path !== "—",
    ) ??
    assignmentContext.assignments.find(
      (candidate) => candidate.page_path !== "—",
    );
  const path = resolveSafeInternalPath(assignment?.page_path, "");
  return path && !path.startsWith("/admin") ? path : null;
}

function HeroRenderedAreaCard({ previewPath }: { previewPath: string | null }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const unavailableTimerRef = useRef<number | null>(null);
  const measurementVersionRef = useRef(0);
  const [shouldMeasure, setShouldMeasure] = useState(false);
  const [state, setState] = useState<HeroRenderedAreaState>(() =>
    previewPath
      ? { status: "loading" }
      : {
          status: "unavailable",
          reason: "اربط الهيرو بصفحة عامة لقياس مساحة العرض الفعلية.",
        },
  );

  const measure = useCallback(() => {
    const frame = iframeRef.current;
    const frameWindow = frame?.contentWindow;
    const frameDocument = frame?.contentDocument;
    if (!frame || !frameWindow || !frameDocument) return false;

    const hero = frameDocument.querySelector<HTMLElement>("[data-hero-family]");
    if (!hero) return false;

    const image = hero.querySelector<HTMLImageElement>(
      "picture img[data-public-media-composition], img[data-public-media-composition], picture img, img",
    );
    const heroRect = hero.getBoundingClientRect();
    const version = ++measurementVersionRef.current;

    if (!image) {
      setState({
        status: "ready",
        metrics: {
          viewportWidth: frameWindow.innerWidth,
          viewportHeight: frameWindow.innerHeight,
          renderedWidth: heroRect.width,
          renderedHeight: heroRect.height,
          visibleImageWidth: 0,
          visibleImageHeight: 0,
          sourceWidth: 0,
          sourceHeight: 0,
          visibleSourceWidth: 0,
          visibleSourceHeight: 0,
          cropTop: 0,
          cropRight: 0,
          cropBottom: 0,
          cropLeft: 0,
          objectFit: "—",
          objectPosition: "—",
          sourcePath: "",
        },
      });
      return true;
    }

    const imageRect = image.getBoundingClientRect();
    const imageStyle = frameWindow.getComputedStyle(image);
    const positionTokens = imageStyle.objectPosition.trim().split(/\s+/);
    const positionX = objectPositionRatio(positionTokens[0], 0.5);
    const positionY = objectPositionRatio(positionTokens[1], 0.5);
    const sourcePath = originalImageSource(
      image.currentSrc || image.src,
      frameWindow.location.href,
    );

    const commitMetrics = (sourceWidth: number, sourceHeight: number) => {
      if (measurementVersionRef.current !== version) return;

      const elementWidth = image.offsetWidth || imageRect.width;
      const elementHeight = image.offsetHeight || imageRect.height;
      const scaleX = elementWidth > 0 ? imageRect.width / elementWidth : 1;
      const scaleY = elementHeight > 0 ? imageRect.height / elementHeight : 1;
      let contentWidth = elementWidth;
      let contentHeight = elementHeight;

      if (sourceWidth > 0 && sourceHeight > 0) {
        if (imageStyle.objectFit === "cover") {
          const scale = Math.max(
            elementWidth / sourceWidth,
            elementHeight / sourceHeight,
          );
          contentWidth = sourceWidth * scale;
          contentHeight = sourceHeight * scale;
        } else if (imageStyle.objectFit === "contain") {
          const scale = Math.min(
            elementWidth / sourceWidth,
            elementHeight / sourceHeight,
          );
          contentWidth = sourceWidth * scale;
          contentHeight = sourceHeight * scale;
        }
      }

      const contentLeft =
        imageRect.left + (elementWidth - contentWidth) * positionX * scaleX;
      const contentTop =
        imageRect.top + (elementHeight - contentHeight) * positionY * scaleY;
      const contentRectWidth = contentWidth * scaleX;
      const contentRectHeight = contentHeight * scaleY;
      const visibleLeft = Math.max(heroRect.left, contentLeft);
      const visibleTop = Math.max(heroRect.top, contentTop);
      const visibleRight = Math.min(
        heroRect.right,
        contentLeft + contentRectWidth,
      );
      const visibleBottom = Math.min(
        heroRect.bottom,
        contentTop + contentRectHeight,
      );
      const visibleImageWidth = Math.max(0, visibleRight - visibleLeft);
      const visibleImageHeight = Math.max(0, visibleBottom - visibleTop);
      const sourceScaleX =
        contentRectWidth > 0 ? sourceWidth / contentRectWidth : 0;
      const sourceScaleY =
        contentRectHeight > 0 ? sourceHeight / contentRectHeight : 0;
      const cropLeft = Math.max(0, visibleLeft - contentLeft) * sourceScaleX;
      const cropTop = Math.max(0, visibleTop - contentTop) * sourceScaleY;
      const visibleSourceWidth = visibleImageWidth * sourceScaleX;
      const visibleSourceHeight = visibleImageHeight * sourceScaleY;

      setState({
        status: "ready",
        metrics: {
          viewportWidth: frameWindow.innerWidth,
          viewportHeight: frameWindow.innerHeight,
          renderedWidth: heroRect.width,
          renderedHeight: heroRect.height,
          visibleImageWidth,
          visibleImageHeight,
          sourceWidth,
          sourceHeight,
          visibleSourceWidth,
          visibleSourceHeight,
          cropTop,
          cropRight: Math.max(0, sourceWidth - cropLeft - visibleSourceWidth),
          cropBottom: Math.max(0, sourceHeight - cropTop - visibleSourceHeight),
          cropLeft,
          objectFit: imageStyle.objectFit,
          objectPosition: imageStyle.objectPosition,
          sourcePath,
        },
      });
    };

    commitMetrics(0, 0); // Rendition naturalWidth is never original metadata.
    if (!sourcePath) return;

    const sourceProbe = frameDocument.createElement("img");
    sourceProbe.onload = () =>
      commitMetrics(sourceProbe.naturalWidth, sourceProbe.naturalHeight);
    sourceProbe.src = sourcePath;
    return true;
  }, []);

  const handleFrameLoad = useCallback(() => {
    mutationObserverRef.current?.disconnect();
    if (unavailableTimerRef.current !== null) {
      window.clearTimeout(unavailableTimerRef.current);
      unavailableTimerRef.current = null;
    }

    const frameDocument = iframeRef.current?.contentDocument;
    if (!frameDocument) {
      setState({
        status: "unavailable",
        reason:
          "تعذر الوصول إلى DOM الصفحة العامة المرتبطة لقياس مساحة الهيرو.",
      });
      return;
    }

    const observeHero = () => {
      const hero =
        frameDocument.querySelector<HTMLElement>("[data-hero-family]");
      if (!hero || !measure()) return false;

      mutationObserverRef.current?.disconnect();
      if (typeof MutationObserver !== "undefined") {
        mutationObserverRef.current = new MutationObserver(measure);
        mutationObserverRef.current.observe(hero, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ["src", "srcset", "data-public-media-composition"],
        });
      }
      return true;
    };

    if (observeHero()) return;

    setState({ status: "loading" });
    if (
      typeof MutationObserver !== "undefined" &&
      frameDocument.documentElement
    ) {
      mutationObserverRef.current = new MutationObserver(observeHero);
      mutationObserverRef.current.observe(frameDocument.documentElement, {
        childList: true,
        subtree: true,
      });
    }
    unavailableTimerRef.current = window.setTimeout(() => {
      unavailableTimerRef.current = null;
      if (observeHero()) return;
      mutationObserverRef.current?.disconnect();
      setState({
        status: "unavailable",
        reason:
          "الصفحة المرتبطة لا تعرض هذا الهيرو حاليًا، لذلك لا يوجد DOM صالح للقياس.",
      });
    }, 4000);
  }, [measure]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!previewPath) return;
    if (!surface || typeof IntersectionObserver === "undefined") {
      const frameId = window.requestAnimationFrame(() =>
        setShouldMeasure(true),
      );
      return () => window.cancelAnimationFrame(frameId);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setShouldMeasure(true);
      observer.disconnect();
    });
    observer.observe(surface);
    return () => observer.disconnect();
  }, [previewPath]);

  useEffect(() => {
    if (!shouldMeasure) return;
    const frame = iframeRef.current;
    let frameId = 0;
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measure);
    };
    const resizeObserver =
      frame && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleMeasure)
        : null;
    if (frame) resizeObserver?.observe(frame);
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      window.cancelAnimationFrame(frameId);
      if (unavailableTimerRef.current !== null) {
        window.clearTimeout(unavailableTimerRef.current);
        unavailableTimerRef.current = null;
      }
      measurementVersionRef.current += 1;
      resizeObserver?.disconnect();
      mutationObserverRef.current?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [measure, shouldMeasure]);

  const metrics = state.status === "ready" ? state.metrics : null;

  return (
    <div
      ref={surfaceRef}
      className="h-full"
      data-hero-rendered-area-state={state.status}
    >
      <AdminCard presentation="premium" className="h-full p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AdminFormControlHeader title="مساحة عرض الهيرو الفعلية" icon={<AdminModuleTabIcon name="overview" />} presentation="leading-icon" />
          {metrics ? (
            <span className="rounded-full border border-[#D8B87A]/20 bg-[#D8B87A]/[0.06] px-2.5 py-1 text-[10px] font-semibold text-[#D8B87A]/80">
              {metrics.viewportWidth < 768 ? "هاتف" : "سطح المكتب"} · DOM مباشر
            </span>
          ) : null}
        </div>

        {state.status === "loading" ? (
          <p className="mt-3 text-xs leading-6 text-white/45">
            جارٍ قياس الصفحة العامة المرتبطة…
          </p>
        ) : state.status === "unavailable" ? (
          <p className="mt-3 text-xs leading-6 text-white/45">{state.reason}</p>
        ) : metrics ? (
          <div className="mt-3 space-y-3">
            <p
              className="font-mono text-lg font-semibold text-[#E6C98D]"
              dir="ltr"
            >
              Rendered Hero Area: {roundedPixels(metrics.renderedWidth)} ×{" "}
              {roundedPixels(metrics.renderedHeight)} px
            </p>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                <dt className="text-white/40">Rendered Width</dt>
                <dd className="mt-1 font-mono text-white/75" dir="ltr">
                  {roundedPixels(metrics.renderedWidth)} px
                </dd>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                <dt className="text-white/40">Rendered Height</dt>
                <dd className="mt-1 font-mono text-white/75" dir="ltr">
                  {roundedPixels(metrics.renderedHeight)} px
                </dd>
              </div>
            </dl>
            <p className="truncate font-mono text-[10px] text-white/30" dir="ltr">
              {previewPath}
            </p>
          </div>
        ) : null}

        {shouldMeasure && previewPath ? (
          <iframe
            ref={iframeRef}
            src={previewPath}
            title="قياس مساحة عرض Hero العامة"
            aria-hidden="true"
            tabIndex={-1}
            onLoad={handleFrameLoad}
            className="pointer-events-none fixed left-[-100000px] top-0 h-screen w-screen border-0 opacity-0"
          />
        ) : null}
      </AdminCard>
    </div>
  );
}

export default function HeroEditClient({
  hero,
  config,
  imagesText,
  mobileImagesText,
  variantOptions,
  saved,
  mediaSynchronizationWarning = false,
  assignmentContext,
  initialTabId,
}: HeroEditClientProps) {
  const primaryCtaLink = legacyHrefFromConfig(
    config,
    "primaryCtaLink",
    "primaryCtaHref",
  );
  const secondaryCtaLink = legacyHrefFromConfig(
    config,
    "secondaryCtaLink",
    "secondaryCtaHref",
  );
  const [guidanceVariant, setGuidanceVariant] = useState(hero.variant);
  const controls = resolveHeroContentControlsForVariant(config, hero.variant);
  const imageComposition = resolveHeroImageCompositionPreset(
    config.imageComposition ??
      config.image_composition ??
      config.imagePositionClassName ??
      config.image_position_class,
  );
  const isStandardInternal = hero.variant === "internal-page";
  const isProjectDetail = hero.variant === "project-detail";
  const previewPath = heroMeasurementPath(assignmentContext);

  const heroIdentityRow = (
    <>
      <input
        type="hidden"
        name="template_description"
        value={hero.description ?? ""}
      />
      <ModuleEditorIdentitySection
        name={hero.name}
        nameLabel="اسم الهيرو"
        status={hero.status}
        inputClassName={fieldClassName("h-11")}
      >
        <AdminFormListboxSelect
          name="variant"
          label="نمط العرض"
          presentation="panel"
          defaultValue={hero.variant}
          onChange={setGuidanceVariant}
          options={variantOptions}
        />
      </ModuleEditorIdentitySection>
    </>
  );

  const contentTab = isProjectDetail ? (
    <div className="space-y-5">
      <AdminFormGrid columns={2}>
        <HeroVisibilityAlignRow
          label="موقع المشروع"
          icon={<AdminModuleTabIcon name="content" />}
          alignmentName="eyebrow_alignment"
          showName="show_eyebrow"
          boldName="eyebrow_bold"
          alignmentDefault={controls.eyebrowAlignment}
          showDefault={controls.showEyebrow}
          boldDefault={controls.eyebrowBold}
        />
        <HeroVisibilityAlignRow
          label="اسم المشروع الإنجليزي"
          icon={<AdminModuleTabIcon name="content" />}
          alignmentName="title_alignment"
          showName="show_title"
          boldName="title_bold"
          alignmentDefault={controls.titleAlignment}
          showDefault={controls.showTitle}
          boldDefault={controls.titleBold}
        />
        <HeroVisibilityAlignRow
          label="اسم المشروع العربي"
          icon={<AdminModuleTabIcon name="content" />}
          alignmentName="subtitle_alignment"
          showName="show_subtitle"
          boldName="subtitle_bold"
          alignmentDefault={controls.subtitleAlignment}
          showDefault={controls.showSubtitle}
          boldDefault={controls.subtitleBold}
        />
        <HeroVisibilityAlignRow
          label="وصف المشروع"
          icon={<AdminModuleTabIcon name="content" />}
          alignmentName="description_alignment"
          showName="show_description"
          boldName="description_bold"
          alignmentDefault={controls.descriptionAlignment}
          boldDefault={controls.descriptionBold}
          showDefault={controls.showDescription}
        />
      </AdminFormGrid>
      <input type="hidden" name="show_highlight" value="false" />
      <input type="hidden" name="highlight_bold" value="false" />
      <input type="hidden" name="highlight_alignment" value="right" />
    </div>
  ) : (
    <div className="space-y-5">
      <AdminFormGrid columns={2}>
        <HeroTextFieldRow
          label="النص التمهيدي"
          name="eyebrow"
          defaultValue={String(config.eyebrow ?? "")}
          boldName="eyebrow_bold"
          alignmentName="eyebrow_alignment"
          showName="show_eyebrow"
          boldDefault={controls.eyebrowBold}
          alignmentDefault={controls.eyebrowAlignment}
          showDefault={controls.showEyebrow}
        />
        <HeroTextFieldRow
          label="العنوان الرئيسي"
          name="title"
          defaultValue={String(config.title ?? "")}
          boldName="title_bold"
          alignmentName="title_alignment"
          showName="show_title"
          boldDefault={controls.titleBold}
          alignmentDefault={controls.titleAlignment}
          showDefault={controls.showTitle}
        />
        <HeroTextFieldRow
          label="النص المميز"
          name="highlight"
          defaultValue={String(config.highlight ?? "")}
          boldName="highlight_bold"
          alignmentName="highlight_alignment"
          showName="show_highlight"
          boldDefault={controls.highlightBold}
          alignmentDefault={controls.highlightAlignment}
          showDefault={controls.showHighlight}
        />
        <HeroTextFieldRow
          label="العنوان الفرعي"
          name="subtitle"
          defaultValue={String(config.subtitle ?? "")}
          boldName="subtitle_bold"
          alignmentName="subtitle_alignment"
          showName="show_subtitle"
          boldDefault={controls.subtitleBold}
          alignmentDefault={controls.subtitleAlignment}
          showDefault={controls.showSubtitle}
        />
        <HeroTextFieldRow
          label="الوصف"
          name="description"
          defaultValue={String(config.description ?? "")}
          preserveRichText
          boldName="description_bold"
          alignmentName="description_alignment"
          showName="show_description"
          boldDefault={controls.descriptionBold}
          alignmentDefault={controls.descriptionAlignment}
          showDefault={controls.showDescription}
          placeholder="اكتب وصف الهيرو..."
        />
      </AdminFormGrid>
    </div>
  );

  const orderTab = (
    <div>
        <HeroElementOrderEditor
          defaultOrder={controls.heroElementOrder}
          allowedKeys={
            isProjectDetail ? PROJECT_DETAIL_HERO_ELEMENT_KEYS : undefined
          }
        />
    </div>
  );

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <ModuleEditorHeader
        moduleKind="hero"
        entityName={hero.name}
        backHref="/admin/pages-blocks/blocks/hero"
        backLabel="الرجوع لكل الهيروهات"
      />

      <AdminFormRuntime key={hero.id} savedRevision={hero.updated_at} mode="edit" entityKey={`block-template-hero:${hero.id}`} redirectAction={updateHeroTemplateDetails}>
        <div className={ADMIN_FORM_STACK_CLASS_NAME}>
        <input type="hidden" name="id" value={hero.id} />
        <input type="hidden" name="slug" value={hero.slug} />
        <input
          type="hidden"
          name="style_preset"
          value={hero.style_preset ?? "cinematic-gold"}
        />
        {heroIdentityRow}

        <ModuleEditorTabs
          moduleKind="hero"
          nowrap
          initialTabId={initialTabId}
          activePanelContext={
            <ModuleEditorFeedbackSlot>
              <BlockEditorSaveFeedback backHref="/admin/pages-blocks/blocks/hero" entityKey={`block-template-hero:${hero.id}`} savedRevision={hero.updated_at} saved={saved} mediaSynchronizationWarning={mediaSynchronizationWarning} />
            </ModuleEditorFeedbackSlot>
          }
          tabs={[
            {
              id: "content",
              sectionHeaderPresentation: "control",
              content: contentTab,
            },
            {
              id: "buttons",
              sectionHeaderPresentation: "control",
              content: (
                <div>
                  {isProjectDetail ? (
                    <HeroVisibilityAlignRow
                      label="تنسيق إجراءات المشروع"
                      icon={<AdminModuleTabIcon name="section" />}
                      alignmentName="cta_alignment"
                      showName="show_cta"
                      boldName="cta_bold"
                      alignmentDefault={controls.ctaAlignment}
                      boldDefault={controls.ctaBold}
                      showDefault
                      enableVisibility={false}
                    >
                      <HeroElementOrderEditor
                        projectActions={{
                          defaultOrder: controls.projectActionOrder,
                          visibility: {
                            download: controls.showProjectDownloadAction,
                            tracking: controls.showProjectTrackingAction,
                            reservation:
                              controls.showProjectReservationAction,
                          },
                        }}
                      />
                    </HeroVisibilityAlignRow>
                  ) : (
                    <HeroCtaFields
                      primaryLabel={String(config.primaryCtaLabel ?? "")}
                      primaryLink={primaryCtaLink}
                      secondaryLabel={String(config.secondaryCtaLabel ?? "")}
                      secondaryLink={secondaryCtaLink}
                      showDefault={controls.showCta}
                      boldDefault={controls.ctaBold}
                      alignmentDefault={controls.ctaAlignment}
                    />
                  )}
                </div>
              ),
            },
            {
              id: "media",
              sectionHeaderPresentation: "control",
              content: (
                <div className="space-y-4" data-hero-media-sections="">
                  <div data-hero-image-composition="">
                    <AdminFormGrid columns={2}>
                      <AdminCard presentation="premium" className="h-full p-3">
                        <AdminFormListboxSelect
                          name="image_composition"
                          sizing="full"
                          label="تكوين الصورة"
                          presentation="panel"
                          defaultValue={imageComposition}
                          options={HERO_IMAGE_COMPOSITION_OPTIONS_AR}
                        />
                      </AdminCard>
                      <HeroRenderedAreaCard previewPath={previewPath} />
                    </AdminFormGrid>
                  </div>
                  {!isProjectDetail ? (
                    <div data-hero-media-section="desktop">
                      <AdminCard presentation="premium" className="p-3">
                        <AdminImagePathListField
                          name="images"
                          mediaSlot={resolveHeroMediaSlot(guidanceVariant, "desktop")}
                          showGuidance={false}
                          showReferenceLabel={false}
                          label="صور سطح المكتب"
                          defaultValue={imagesText}
                          density="compact"
                          actionPresentation="card"
                          enableDragDrop
                          dragFromImage
                        />
                      </AdminCard>
                    </div>
                  ) : null}
                  {!isProjectDetail ? (
                    <div data-hero-media-section="mobile">
                      <AdminCard presentation="premium" className="p-3">
                        <AdminImagePathListField
                          name="mobile_images"
                          mediaSlot={resolveHeroMediaSlot(guidanceVariant, "mobile")}
                          showGuidance={false}
                          showReferenceLabel={false}
                          label="صور الهاتف المحمول"
                          defaultValue={mobileImagesText}
                          density="compact"
                          actionPresentation="card"
                          enableDragDrop
                          dragFromImage
                        />
                      </AdminCard>
                    </div>
                  ) : null}
                </div>
              ),
            },
            ...(!isStandardInternal
              ? [
                  {
                    id: "order",
                    sectionHeaderPresentation: "control" as const,
                    content: orderTab,
                  },
                ]
              : []),
            {
              id: "display",
              sectionHeaderPresentation: "control",
              content: (
                <ModuleEditorPagesTab
                  moduleName={hero.name}
                  assignmentContext={assignmentContext}
                />
              ),
            },
          ]}
        />

        <ModuleEditorSaveArea saveLabel="حفظ الهيرو" />
        </div>
      </AdminFormRuntime>
    </div>
  );
}
