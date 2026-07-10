import type { Metadata } from "next";

import { getGlobalSeoDefaults } from "./global-seo-defaults";
import type { BuildMetadataInput } from "../../config/seo/seo-types";
import { resolveSeoMetadata } from "./resolve-seo-metadata";
import { buildMetadataFromResolved } from "./build-metadata-from-resolved";

/** @deprecated Prefer generatePublicMetadata for DB-backed SEO layers. */
export function buildMetadata(input: BuildMetadataInput): Metadata {
  const globalSeo = getGlobalSeoDefaults();
  const resolved = resolveSeoMetadata(input, globalSeo);
  return buildMetadataFromResolved(resolved);
}
