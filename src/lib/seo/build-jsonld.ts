import {
  SCHEMA_ORGANIZATION,
  SCHEMA_WEBSITE,
} from "../../config/seo/schema-data";
import { SEO_SITE } from "../../config/seo/seo-site";
import type { SeoOpenGraphType } from "../../config/seo/seo-types";
import { absoluteAssetUrl, absoluteUrl } from "./seo-utils";
import {
  buildBreadcrumbSchema,
  type BreadcrumbItem,
} from "./build-breadcrumbs";
import { buildFaqSchema, type FaqSchemaItem } from "./build-faq-schema";

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    ...SCHEMA_ORGANIZATION,
  };
}

export function buildWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    ...SCHEMA_WEBSITE,
    publisher: {
      "@type": "Organization",
      name: SEO_SITE.name,
      url: SEO_SITE.defaultUrl,
    },
  };
}

export function buildArticleSchema(input: {
  path: string;
  title: string;
  description: string;
  image?: string;
  publishedAt?: string;
  updatedAt?: string;
  authorName?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    image: absoluteAssetUrl(input.image ?? SEO_SITE.defaultImage),
    datePublished: input.publishedAt,
    dateModified: input.updatedAt ?? input.publishedAt,
    author: {
      "@type": "Organization",
      name: input.authorName ?? SEO_SITE.name,
    },
    publisher: {
      "@type": "Organization",
      name: SEO_SITE.name,
      logo: {
        "@type": "ImageObject",
        url: absoluteAssetUrl(SEO_SITE.logo),
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(input.path),
    },
  };
}

type PageJsonLdSchema =
  | ReturnType<typeof buildOrganizationSchema>
  | ReturnType<typeof buildWebsiteSchema>
  | ReturnType<typeof buildBreadcrumbSchema>
  | ReturnType<typeof buildArticleSchema>
  | ReturnType<typeof buildFaqSchema>;

export function buildPageJsonLd(input: {
  path: string;
  title: string;
  description: string;
  type?: SeoOpenGraphType;
  image?: string;
  breadcrumbs?: BreadcrumbItem[];
  publishedAt?: string;
  updatedAt?: string;
  faqs?: readonly FaqSchemaItem[];
}) {
  const schemas: PageJsonLdSchema[] = [buildOrganizationSchema(), buildWebsiteSchema()];

  if (input.breadcrumbs?.length) {
    schemas.push(buildBreadcrumbSchema(input.breadcrumbs));
  }

  if (input.type === "article") {
    schemas.push(
      buildArticleSchema({
        path: input.path,
        title: input.title,
        description: input.description,
        image: input.image,
        publishedAt: input.publishedAt,
        updatedAt: input.updatedAt,
      })
    );
  }

  if (input.faqs?.length) {
    schemas.push(buildFaqSchema(input.faqs));
  }

  return schemas;
}