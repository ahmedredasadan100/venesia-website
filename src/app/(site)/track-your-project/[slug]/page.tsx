import { notFound } from "next/navigation";
import type { Metadata } from "next";

import ProjectTrackSkeleton from "../../../../components/track/ProjectTrackSkeleton";
import {
  getProjectHref,
} from "../../../../lib/projects/public-helpers";
import { loadProjectBySlug } from "../../../../lib/projects/load-published-projects";
import { NO_INDEX_ROBOTS } from "../../../../config/seo/seo-rules";
import { buildMetadata } from "../../../../lib/seo/build-metadata";

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
  const project = await loadProjectBySlug(slug);

  if (!project) {
    return buildMetadata({
      path: "/track-your-project",
      title: "متابعة المشروع غير متاحة | فينيسيا للتطوير العقاري",
      description: "صفحة متابعة المشروع غير متاحة حاليًا.",
      robots: NO_INDEX_ROBOTS,
    });
  }

  return buildMetadata({
    path: `/track-your-project/${project.slug}`,
    title: `متابعة ${project.arabicName} | فينيسيا للتطوير العقاري`,
    description: "جاري تحديث بيانات متابعة مراحل التنفيذ لهذا المشروع.",
    robots: NO_INDEX_ROBOTS,
  });
}

export default async function ProjectTrackPage({ params }: ProjectTrackPageProps) {
  const { slug } = await params;
  const project = await loadProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white">
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />
      <ProjectTrackSkeleton
        projectCode={project.code}
        projectName={project.arabicName}
        projectHref={getProjectHref(project)}
      />
    </div>
  );
}
