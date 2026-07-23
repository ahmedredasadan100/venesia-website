import { z } from "zod";

import { ADMIN_TONE_TOKENS } from "./admin-tone-palette";
import { slugifyFromTitle, validateSlugFormat } from "../slug";

const taxonomyNameSchema = z
  .string()
  .trim()
  .min(1, "الاسم مطلوب.")
  .max(160, "الاسم طويل جدًا.");

const taxonomySlugSchema = z
  .string()
  .trim()
  .min(1, "Slug مطلوب.")
  .superRefine((value, context) => {
    const error = validateSlugFormat(value);
    if (error) context.addIssue({ code: "custom", message: error });
  });

const nullablePositiveIdSchema = z.preprocess(
  (value) => {
    if (value === "" || value == null) return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : value;
  },
  z.number().int().positive("القيمة المحددة غير صالحة.").nullable(),
);

const requiredPositiveIdSchema = z.preprocess(
  (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : value;
  },
  z.number().int().positive("القيمة المحددة غير صالحة."),
);

const checkboxSchema = z.preprocess(
  (value) => value === true || value === "true" || value === "on",
  z.boolean(),
);

const colorTokenSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.enum(ADMIN_TONE_TOKENS).nullable(),
);

export const categoryTaxonomyFormSchema = z.object({
  name: taxonomyNameSchema,
  slug: taxonomySlugSchema,
  parent_id: nullablePositiveIdSchema,
  is_published: checkboxSchema,
  color_token: colorTokenSchema,
});

export const seriesTaxonomyFormSchema = z.object({
  name: taxonomyNameSchema,
  slug: taxonomySlugSchema,
  category_id: requiredPositiveIdSchema,
  is_published: checkboxSchema,
});

export type CategoryTaxonomyFormInput = z.infer<
  typeof categoryTaxonomyFormSchema
>;
export type SeriesTaxonomyFormInput = z.infer<
  typeof seriesTaxonomyFormSchema
>;

export type TaxonomyFieldErrors = Record<string, string[]>;

export function taxonomyFormDataValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function categoryTaxonomyFormInput(formData: FormData) {
  const name = taxonomyFormDataValue(formData, "name");
  const rawSlug = taxonomyFormDataValue(formData, "slug");
  return {
    name,
    slug: rawSlug || slugifyFromTitle(name),
    parent_id: taxonomyFormDataValue(formData, "parent_id"),
    is_published: formData.get("is_published"),
    color_token: taxonomyFormDataValue(formData, "color_token"),
  };
}

export function seriesTaxonomyFormInput(formData: FormData) {
  const name = taxonomyFormDataValue(formData, "name");
  const rawSlug = taxonomyFormDataValue(formData, "slug");
  return {
    name,
    slug: rawSlug || slugifyFromTitle(name),
    category_id: taxonomyFormDataValue(formData, "category_id"),
    is_published: formData.get("is_published"),
  };
}

export function flattenTaxonomyValidationErrors(
  error: z.ZodError,
): TaxonomyFieldErrors {
  const errors: TaxonomyFieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] = [...(errors[key] ?? []), issue.message];
  }
  return errors;
}
