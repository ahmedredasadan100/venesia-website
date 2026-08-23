import { notFound } from "next/navigation";
import type { Metadata } from "next";

import ProjectTrackingExperience, {
  ProjectTrackingUnavailableState,
} from "../../../../components/track/ProjectTrackingExperience";
import { loadProjectTrackingDetail } from "../../../../lib/projects/tracking/public-read";
import { NO_INDEX_ROBOTS } from "../../../../config/seo/seo-rules";
import { generatePublicMetadata } from "../../../../lib/seo/generate-public-metadata";
import type { ProjectTrackingReadInput } from "../../../../lib/projects/tracking/contract";

export const revalidate = 300;

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
  return {
    stagePage: value("stagePage"),
    itemPage: value("itemPage"),
    updatePage: value("updatePage"),
    mediaPage: value("mediaPage"),
    historyPage: value("historyPage"),
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
      path: "/track-your-project",
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
    path: `/track-your-project/${result.detail.project.slug}`,
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
