import { notFound } from "next/navigation";
import type { Metadata } from "next";

import ProjectTrackingExperience, {
  ProjectTrackingUnavailableState,
} from "../../../../components/track/ProjectTrackingExperience";
import { loadProjectTrackingDetail } from "../../../../lib/projects/tracking/public-read";
import { NO_INDEX_ROBOTS } from "../../../../config/seo/seo-rules";
import { generatePublicMetadata } from "../../../../lib/seo/generate-public-metadata";
import {
  projectTrackingReadInputSchema,
  type ProjectTrackingReadInput,
} from "../../../../lib/projects/tracking/contract";
import { getPublicPageRoute } from "../../../../lib/admin/links/static-routes";
import { getProjectTrackHref } from "../../../../lib/projects/public-helpers";

export const revalidate = 300;
const TRACKING_PAGE_IDENTITY = getPublicPageRoute("track-your-project");

type ProjectTrackPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function trackingReadInput(
  searchParams: Record<string, string | string[] | undefined>,
): ProjectTrackingReadInput {
  const value = (key: string) => {
    const candidate = searchParams[key];
    return typeof candidate === "string" ? candidate : undefined;
  };
  // Recover invalid URL pagination through the existing defaults; reads stay strict.
  const page = (
    key: "stagePage" | "itemPage" | "updatePage" | "mediaPage" | "historyPage",
  ) => {
    const parsed = projectTrackingReadInputSchema.shape[key].safeParse(value(key));
    return parsed.success ? parsed.data : undefined;
  };
  return {
    stagePage: page("stagePage"),
    itemPage: page("itemPage"),
    updatePage: page("updatePage"),
    mediaPage: page("mediaPage"),
    historyPage: page("historyPage"),
    stageId: value("stage"),
    itemId: value("item"),
    updateId: value("update"),
  };
}

export async function generateMetadata({
  params,
}: ProjectTrackPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadProjectTrackingDetail(slug);

  if (result.status !== "ready") {
    return generatePublicMetadata({
      path: TRACKING_PAGE_IDENTITY.href,
      title:
        result.status === "unavailable"
          ? `متابعة ${result.project.arabicName} غير متاحة مؤقتًا`
          : "متابعة المشروع غير متاحة",
      description:
        result.status === "unavailable"
          ? "بيانات متابعة التنفيذ غير متاحة مؤقتًا."
          : "صفحة متابعة المشروع غير متاحة حاليًا.",
      robots: NO_INDEX_ROBOTS,
    });
  }

  return generatePublicMetadata({
    path: getProjectTrackHref(result.detail.project),
    title: `متابعة ${result.detail.project.arabicName}`,
    description: result.detail.latestUpdate?.body ?? `تابع مراحل تنفيذ ${result.detail.project.arabicName} وآخر تحديثات المشروع الموثقة.`,
    robots: NO_INDEX_ROBOTS,
  });
}

export default async function ProjectTrackPage({ params, searchParams }: ProjectTrackPageProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const result = await loadProjectTrackingDetail(
    slug,
    trackingReadInput(rawSearchParams),
  );

  if (result.status === "not_found") {
    notFound();
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white">
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />
      {result.status === "unavailable" ? (
        <ProjectTrackingUnavailableState projectName={result.project.arabicName} />
      ) : (
        <ProjectTrackingExperience detail={result.detail} />
      )}
    </div>
  );
}
