import { notFound } from "next/navigation";
import type { Metadata } from "next";

import CommercialProjectDetails from "../../../../components/projects/details/CommercialProjectDetails";
import ResidentialProjectDetails from "../../../../components/projects/details/ResidentialProjectDetails";
import JsonLd from "../../../../components/seo/JsonLd";
import { loadProjectBySlug } from "../../../../lib/projects/load-published-projects";
import { stripHtml } from "../../../../lib/rich-text/html-utils";
import { NO_INDEX_ROBOTS } from "../../../../config/seo/seo-rules";
import { generatePublicMetadata, loadResolvedGlobalSeo } from "../../../../lib/seo/generate-public-metadata";
import { buildPageJsonLd } from "../../../../lib/seo/build-jsonld";

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
    return generatePublicMetadata({
      path: "/projects",
      title: "المشروع غير موجود | فينيسيا للتطوير العقاري",
      description: "المشروع المطلوب غير متاح حاليًا.",
      robots: NO_INDEX_ROBOTS,
      includePageSeo: false,
    });
  }

  const pagePath = `/projects/${project.slug}`;
  const fallbackDescription = stripHtml(project.shortDescription);

  return generatePublicMetadata({
    path: pagePath,
    entitySeo: {
      title: project.seoTitle,
      description: project.seoDescription,
      keywords: project.seoKeywords,
      ogImage: project.ogImage,
      image: project.ogImage || project.heroImage || project.image,
      imageAlt: project.arabicName,
    },
    title: project.seoTitle || `${project.arabicName} | فينيسيا للتطوير العقاري`,
    description: project.seoDescription || fallbackDescription,
    image: project.ogImage || project.heroImage || project.image,
    imageAlt: project.arabicName,
    type: "website",
    includePageSeo: false,
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

  const globalSeo = await loadResolvedGlobalSeo();
  const pagePath = `/projects/${project.slug}`;
  const description = stripHtml(project.seoDescription || project.shortDescription);

  const pageJsonLd = buildPageJsonLd(
    {
      path: pagePath,
      title: project.seoTitle || project.arabicName,
      description,
      image: project.ogImage || project.heroImage || project.image,
      project: {
        name: project.arabicName,
        description,
        image: project.ogImage || project.heroImage || project.image,
        locationLabel: project.locationLabel,
      },
    },
    globalSeo,
  );

  const details =
    project.category === "commercial" ? (
      <CommercialProjectDetails project={project} />
    ) : (
      <ResidentialProjectDetails project={project} />
    );

  return (
    <>
      <JsonLd data={pageJsonLd} />
      {details}
    </>
  );
}
