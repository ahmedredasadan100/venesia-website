import { notFound } from "next/navigation";
import type { Metadata } from "next";

import CommercialProjectDetails from "../../../../components/projects/details/CommercialProjectDetails";
import ResidentialProjectDetails from "../../../../components/projects/details/ResidentialProjectDetails";
import { loadProjectBySlug } from "../../../../lib/projects/load-published-projects";
import { stripHtml } from "../../../../lib/rich-text/html-utils";
import { NO_INDEX_ROBOTS } from "../../../../config/seo/seo-rules";
import { buildMetadata } from "../../../../lib/seo/build-metadata";

export const revalidate = 300;

type ProjectDetailsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: ProjectDetailsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await loadProjectBySlug(slug);

  if (!project) {
    return buildMetadata({
      path: "/projects",
      title: "المشروع غير موجود | فينيسيا للتطوير العقاري",
      description: "المشروع المطلوب غير متاح حاليًا.",
      robots: NO_INDEX_ROBOTS,
    });
  }

  return buildMetadata({
    path: `/projects/${project.slug}`,
    title: `${project.arabicName} | فينيسيا للتطوير العقاري`,
    description: stripHtml(project.shortDescription),
    image: project.heroImage || project.image,
    type: "website",
  });
}

export default async function ProjectDetailsPage({
  params,
}: ProjectDetailsPageProps) {
  const { slug } = await params;
  const project = await loadProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  if (project.category === "commercial") {
    return <CommercialProjectDetails project={project} />;
  }

  return <ResidentialProjectDetails project={project} />;
}
