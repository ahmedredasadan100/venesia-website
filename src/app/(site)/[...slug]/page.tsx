import { notFound } from "next/navigation";

import RevealAnimations from "../../../components/RevealAnimations";
import PageSlotLayout from "../../../components/page-composition/PageSlotLayout";
import {
  getPublishedPageStateByPath,
  type PublishedPageByPath,
  type PublishedPageByPathLookupResult,
} from "../../../lib/pages/get-published-page-by-path";
import { resolvePublicPathFromSlugSegments } from "../../../lib/pages/normalize-page-path";
import { isReservedPublicPath } from "../../../lib/pages/reserved-public-paths";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";
import { entitySeoDataFromPersistence } from "../../../lib/seo/entity-seo-types";

export const revalidate = 300;

type DynamicCmsPageProps = {
  params: Promise<{ slug: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function resolveDynamicCmsPage(
  params: Promise<{ slug: string[] }>,
): Promise<PublishedPageByPathLookupResult> {
  const { slug } = await params;
  const normalized = resolvePublicPathFromSlugSegments(slug);

  if (!normalized.ok) {
    return { page: null, sourceStatus: "missing" };
  }

  if (isReservedPublicPath(normalized.path)) {
    return { page: null, sourceStatus: "missing" };
  }

  return getPublishedPageStateByPath(normalized.path);
}

function requireDynamicCmsPage(
  result: PublishedPageByPathLookupResult,
): PublishedPageByPath {
  if (result.sourceStatus === "error") {
    if (result.sourceError instanceof Error) {
      throw result.sourceError;
    }
    throw new Error(result.sourceIssue ?? "Published page query failed.");
  }

  if (!result.page) {
    notFound();
  }

  return result.page;
}

export async function generateMetadata({ params }: DynamicCmsPageProps) {
  const page = requireDynamicCmsPage(await resolveDynamicCmsPage(params));

  return generatePublicMetadata({
    path: page.path,
    title: page.title,
    includePageSeo: false,
    entitySeo: entitySeoDataFromPersistence(page),
  });
}

export default async function DynamicCmsPage({ params, searchParams }: DynamicCmsPageProps) {
  const [pageResult, resolvedSearchParams] = await Promise.all([
    resolveDynamicCmsPage(params),
    searchParams ?? Promise.resolve({}),
  ]);
  const page = requireDynamicCmsPage(pageResult);

  const composition = await loadPageCompositionBySlug(page.slug);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white">
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />
      <main className="relative z-10">
        <PageSlotLayout
          composition={composition}
          publicPath={page.path}
          searchParams={resolvedSearchParams}
          listingContext={{
            publicPath: page.path,
            searchParams: resolvedSearchParams,
          }}
        />
      </main>
      <RevealAnimations />
    </div>
  );
}
