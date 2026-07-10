import type { GlobalSeoSettings } from "./global-seo-types";
import {
  buildBreadcrumbSchema,
  type BreadcrumbItem,
} from "./build-breadcrumbs";
import { buildFaqSchema, type FaqSchemaItem } from "./build-faq-schema";
import type { JsonLdObject, JsonLdValue } from "./jsonld-types";
import { absoluteAssetUrl, absoluteUrlWithBase } from "./seo-utils";

export function buildOrganizationSchema(global?: GlobalSeoSettings): JsonLdObject {
  const baseUrl = global?.canonicalBaseUrl || global?.siteUrl || "";
  const name = global?.organizationName || global?.siteName || "";
  const logo = global?.organizationLogo || "";

  const schema: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name,
    url: baseUrl || undefined,
  };

  if (global?.organizationDescription) {
    schema.description = global.organizationDescription;
  }

  if (logo) {
    schema.logo = absoluteAssetUrl(logo, baseUrl);
    schema.image = absoluteAssetUrl(logo, baseUrl);
  }

  if (global?.organizationPhone) {
    schema.telephone = global.organizationPhone;
  }

  if (global?.organizationEmail) {
    schema.email = global.organizationEmail;
  }

  if (global?.organizationAddress) {
    schema.address = {
      "@type": "PostalAddress",
      streetAddress: global.organizationAddress,
    };
  }

  if (global?.organizationSocialLinks?.length) {
    schema.sameAs = global.organizationSocialLinks.map((item) => item.href);
  }

  return schema;
}

export function buildWebsiteSchema(global?: GlobalSeoSettings): JsonLdObject {
  const baseUrl = global?.canonicalBaseUrl || global?.siteUrl || "";
  const siteName = global?.siteName || global?.organizationName || "";

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: baseUrl || undefined,
    publisher: {
      "@type": "Organization",
      name: global?.organizationName || siteName,
      url: baseUrl || undefined,
    },
  };
}

export function buildArticleSchema(
  input: {
    path: string;
    title: string;
    description: string;
    image?: string;
    publishedAt?: string;
    updatedAt?: string;
    authorName?: string;
  },
  global?: GlobalSeoSettings,
): JsonLdObject {
  const baseUrl = global?.canonicalBaseUrl || global?.siteUrl || "";
  const publisherName = global?.organizationName || global?.siteName || "";
  const logo = global?.organizationLogo || "";

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    image: absoluteAssetUrl(input.image, baseUrl),
    datePublished: input.publishedAt,
    dateModified: input.updatedAt ?? input.publishedAt,
    author: {
      "@type": "Organization",
      name: input.authorName ?? publisherName,
    },
    publisher: {
      "@type": "Organization",
      name: publisherName,
      ...(logo
        ? {
            logo: {
              "@type": "ImageObject",
              url: absoluteAssetUrl(logo, baseUrl),
            },
          }
        : {}),
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrlWithBase(input.path, baseUrl),
    },
  };
}

export function buildProjectSchema(
  input: {
    path: string;
    name: string;
    description: string;
    image?: string;
    locationLabel?: string;
  },
  global?: GlobalSeoSettings,
): JsonLdObject {
  const baseUrl = global?.canonicalBaseUrl || global?.siteUrl || "";

  const schema: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: input.name,
    description: input.description,
    url: absoluteUrlWithBase(input.path, baseUrl),
  };

  if (input.image) {
    schema.image = absoluteAssetUrl(input.image, baseUrl);
  }

  if (input.locationLabel) {
    schema.address = {
      "@type": "PostalAddress",
      addressLocality: input.locationLabel,
    };
  }

  return schema;
}

export function buildPageJsonLd(
  input: {
    path: string;
    title: string;
    description: string;
    type?: "website" | "article";
    image?: string;
    breadcrumbs?: BreadcrumbItem[];
    publishedAt?: string;
    updatedAt?: string;
    faqs?: readonly FaqSchemaItem[];
    project?: {
      name: string;
      description: string;
      image?: string;
      locationLabel?: string;
    };
  },
  global?: GlobalSeoSettings,
): JsonLdValue[] {
  const baseUrl = global?.canonicalBaseUrl || global?.siteUrl;
  const schemas: JsonLdValue[] = [];

  if (input.breadcrumbs?.length) {
    schemas.push(buildBreadcrumbSchema(input.breadcrumbs, baseUrl));
  }

  if (input.type === "article") {
    schemas.push(
      buildArticleSchema(
        {
          path: input.path,
          title: input.title,
          description: input.description,
          image: input.image,
          publishedAt: input.publishedAt,
          updatedAt: input.updatedAt,
        },
        global,
      ),
    );
  }

  if (input.project) {
    schemas.push(
      buildProjectSchema(
        {
          path: input.path,
          name: input.project.name,
          description: input.project.description,
          image: input.project.image,
          locationLabel: input.project.locationLabel,
        },
        global,
      ),
    );
  }

  if (input.faqs?.length) {
    schemas.push(buildFaqSchema(input.faqs));
  }

  return schemas;
}
