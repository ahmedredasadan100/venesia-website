import { notFound } from "next/navigation";
import type { Metadata } from "next";

import ProjectTrackingExperience, {
  ProjectTrackingUnavailableState,
} from "../../../../components/track/ProjectTrackingExperience";
import { loadProjectTrackingDetail } from "../../../../lib/projects/tracking/public-read";
import { NO_INDEX_ROBOTS } from "../../../../config/seo/seo-rules";
import { generatePublicMetadata } from "../../../../lib/seo/generate-public-metadata";

export const revalidate = 300;

type ProjectTrackPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

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
          ? `متابعة ${result.project.arabicName} غير متاحة مؤقتًا | فينيسيا للتطوير العقاري`
          : "متابعة المشروع غير متاحة | فينيسيا للتطوير العقاري",
      description:
        result.status === "unavailable"
          ? "بيانات متابعة التنفيذ غير متاحة مؤقتًا."
          : "صفحة متابعة المشروع غير متاحة حاليًا.",
      robots: NO_INDEX_ROBOTS,
    });
  }

  return generatePublicMetadata({
    path: `/track-your-project/${result.detail.project.slug}`,
    title: `متابعة ${result.detail.project.arabicName} | فينيسيا للتطوير العقاري`,
    description: result.detail.latestUpdate?.body ?? `تابع مراحل تنفيذ ${result.detail.project.arabicName} وآخر تحديثات المشروع الموثقة.`,
    robots: NO_INDEX_ROBOTS,
  });
}

export default async function ProjectTrackPage({ params }: ProjectTrackPageProps) {
  const { slug } = await params;
  const result = await loadProjectTrackingDetail(slug);

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
