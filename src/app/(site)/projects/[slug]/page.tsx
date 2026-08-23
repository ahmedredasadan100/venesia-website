import { notFound } from "next/navigation";
import type { Metadata } from "next";

import CommercialProjectDetails from "../../../../components/projects/details/CommercialProjectDetails";
import ResidentialProjectDetails from "../../../../components/projects/details/ResidentialProjectDetails";
import JsonLd from "../../../../components/seo/JsonLd";
import { loadProjectBySlugResult } from "../../../../lib/projects/load-published-projects";
import { stripHtml } from "../../../../lib/rich-text/html-utils";
import { NO_INDEX_ROBOTS } from "../../../../config/seo/seo-rules";
import { generatePublicMetadata, loadResolvedGlobalSeo } from "../../../../lib/seo/generate-public-metadata";
import { buildPageJsonLd } from "../../../../lib/seo/build-jsonld";
import { getDomainBackedHeroTemplateState } from "../../../../lib/load-hero-section";
import { getHeroConfig } from "../../../../lib/page-sections";
import { resolveVisibleProjectLocationLabel } from "../../../../lib/projects/project-location-presentation";

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
  const result = await loadProjectBySlugResult(slug);
  const project = result.project;

  if (!project) {
    return generatePublicMetadata({
      path: "/projects",
      title: "المشروع غير موجود",
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
      title: project.seo.title,
      description: project.seo.description,
      keywords: project.seo.keywords,
      ogImage: project.seo.ogImage?.src,
      ogImageAlt: project.seo.ogImage?.alt,
      image: project.seo.ogImage?.src ?? project.heroImage.src,
      imageAlt: project.seo.ogImage?.alt || project.heroImage.alt,
      canonical: project.seo.canonicalUrl,
      robotsIndex: project.seo.robotsIndex,
      robotsFollow: project.seo.robotsFollow,
    },
    title: project.seo.title || project.arabicName,
    description: project.seo.description || fallbackDescription,
    image: project.seo.ogImage?.src ?? project.heroImage.src,
    imageAlt: project.seo.ogImage?.alt || project.heroImage.alt,
    type: "website",
    includePageSeo: false,
  });
}

export default async function ProjectDetailsPage({
  params,
}: ProjectDetailsPageProps) {
  const { slug } = await params;
  const [result, projectDetailHeroState] = await Promise.all([
    loadProjectBySlugResult(slug),
    getDomainBackedHeroTemplateState("project-detail"),
  ]);
  const project = result.project;

  if (!project) {
    notFound();
  }

  const globalSeo = await loadResolvedGlobalSeo();
  const pagePath = `/projects/${project.slug}`;
  const description = stripHtml(project.seo.description || project.shortDescription);
  const heroPresentation = projectDetailHeroState.hero
    ? getHeroConfig(projectDetailHeroState.hero)
    : undefined;
  const showProjectHero = projectDetailHeroState.visibility !== "hidden";
  const locationLabel = resolveVisibleProjectLocationLabel(project.location);

  const pageJsonLd = buildPageJsonLd(
    {
      path: pagePath,
      title: project.seo.title || project.arabicName,
      description,
      image: project.seo.ogImage?.src ?? project.heroImage.src,
      project: {
        name: project.arabicName,
        description,
        image: project.seo.ogImage?.src ?? project.heroImage.src,
        locationLabel: locationLabel ?? undefined,
      },
    },
    globalSeo,
  );

  const details =
    project.category === "commercial" ? (
      <CommercialProjectDetails
        project={project}
        heroPresentation={heroPresentation}
        showProjectHero={showProjectHero}
      />
    ) : (
      <ResidentialProjectDetails
        project={project}
        heroPresentation={heroPresentation}
        showProjectHero={showProjectHero}
      />
    );

  return (
    <>
      <JsonLd data={pageJsonLd} />
      {details}
    </>
  );
}
