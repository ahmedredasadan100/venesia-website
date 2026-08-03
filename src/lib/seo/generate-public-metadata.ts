import "server-only";

import type { Metadata } from "next";

import { getGlobalSeoDefaults } from "./global-seo-defaults";
import { loadGlobalSeoSettings } from "./load-global-seo-settings";
import { loadPageSeoByPath } from "./load-page-seo";
import {
  mergeEntitySeoData,
  type ResolveSeoMetadataInput,
} from "./entity-seo-types";
import { resolveSeoMetadata } from "./resolve-seo-metadata";
import { buildMetadataFromResolved } from "./build-metadata-from-resolved";

export type GeneratePublicMetadataInput = ResolveSeoMetadataInput & {
  includePageSeo?: boolean;
};

export async function generatePublicMetadata(
  input: GeneratePublicMetadataInput,
): Promise<Metadata> {
  const globalSeo = await loadGlobalSeoSettings().catch(() => getGlobalSeoDefaults());

  const pageSeo =
    input.includePageSeo === false
      ? null
      : await loadPageSeoByPath(input.path).catch(() => null);

  const resolved = resolveSeoMetadata({
    ...input,
    entitySeo: mergeEntitySeoData(input.entitySeo, pageSeo),
  }, globalSeo);

  return buildMetadataFromResolved(resolved);
}

export async function loadResolvedGlobalSeo() {
  return loadGlobalSeoSettings().catch(() => getGlobalSeoDefaults());
}
