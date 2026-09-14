import "server-only";

import type { Json } from "../../database.types";
import {
  deriveEntitySeoScore,
  PROJECT_SEO_SOURCE_COLUMNS,
  toProjectSeoScoreInput,
  type ProjectSeoSource,
} from "../seo/entity-seo-persistence";

export const PROJECT_DUPLICATE_MAX_COPY_NUMBER = 10_000;
export const PROJECT_DUPLICATE_SEO_MAX_ATTEMPTS = 3;

export type ProjectDuplicateSeoSnapshot = ProjectSeoSource & {
  arabic_name: string;
  slug: string;
  updated_at: string;
};

/** Mirrors the existing duplicate allocator's identity, never its SEO algorithm. */
export function projectDuplicateSlug(sourceSlug: string, copyNumber: number): string {
  if (!Number.isInteger(copyNumber) || copyNumber < 1 || copyNumber > PROJECT_DUPLICATE_MAX_COPY_NUMBER) {
    throw new Error("Invalid Project duplicate copy number.");
  }
  return `${sourceSlug}-copy${copyNumber === 1 ? "" : `-${copyNumber}`}`;
}

export function buildProjectDuplicateSeoProof(
  source: ProjectDuplicateSeoSnapshot,
  copyNumber: number,
) {
  const expectedSource: Record<string, Json> = Object.fromEntries(
    PROJECT_SEO_SOURCE_COLUMNS.map((key) => [key, source[key] ?? null]),
  );
  const expectedResult = {
    ...expectedSource,
    arabic_name: `${source.arabic_name} — نسخة${copyNumber === 1 ? "" : ` ${copyNumber}`}`,
    slug: projectDuplicateSlug(source.slug, copyNumber),
  };
  return {
    expected_updated_at: source.updated_at,
    expected_source: expectedSource,
    expected_result: expectedResult,
    score: deriveEntitySeoScore(toProjectSeoScoreInput({
      ...source,
      arabic_name: expectedResult.arabic_name,
      slug: expectedResult.slug,
    })),
  };
}
