import { notFound } from "next/navigation";

import RevealAnimations from "../../../components/RevealAnimations";
import PageSlotLayout from "../../../components/page-composition/PageSlotLayout";
import { getPublishedPageByPath } from "../../../lib/pages/get-published-page-by-path";
import { resolvePublicPathFromSlugSegments } from "../../../lib/pages/normalize-page-path";
import { isReservedPublicPath } from "../../../lib/pages/reserved-public-paths";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";
import { entitySeoDataFromPersistence } from "../../../lib/seo/entity-seo-types";

export const revalidate = 300;

type DynamicCmsPageProps = {
  params: Promise<{ slug: string[] }>;
};

async function resolveDynamicCmsPage(params: Promise<{ slug: string[] }>) {
  const { slug } = await params;
  const normalized = resolvePublicPathFromSlugSegments(slug);

  if (!normalized.ok) {
    return null;
  }

  if (isReservedPublicPath(normalized.path)) {
    return null;
  }

  return getPublishedPageByPath(normalized.path);
}

export async function generateMetadata({ params }: DynamicCmsPageProps) {
  const page = await resolveDynamicCmsPage(params);

  if (!page) {
    notFound();
  }

  return generatePublicMetadata({
    path: page.path,
    title: page.title,
    includePageSeo: false,
    entitySeo: entitySeoDataFromPersistence(page),
  });
}

export default async function DynamicCmsPage({ params }: DynamicCmsPageProps) {
  const page = await resolveDynamicCmsPage(params);

  if (!page) {
    notFound();
  }

  const composition = await loadPageCompositionBySlug(page.slug, "stack");

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white">
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />
      <main className="relative z-10">
        <PageSlotLayout composition={composition} />
      </main>
      <RevealAnimations />
    </div>
  );
}
