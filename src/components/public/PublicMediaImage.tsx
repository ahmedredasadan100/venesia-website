"use client";

import Image, { getImageProps, type ImageProps } from "next/image";
import { useState } from "react";

export const PUBLIC_MEDIA_IMAGE_FALLBACK = "/images/venesia-5.png";

export const PUBLIC_MEDIA_COMPOSITIONS = {
  "cover-center": { objectFit: "cover", objectPosition: "50% 50%" },
  "cover-upper": { objectFit: "cover", objectPosition: "42% 36%" },
} as const satisfies Record<string, Pick<React.CSSProperties, "objectFit" | "objectPosition">>;

export type PublicMediaComposition = keyof typeof PUBLIC_MEDIA_COMPOSITIONS;

export type PublicMediaImageProps = ImageProps & {
  /** Product-level composition preset. Raw CSS positioning stays owned here. */
  composition?: PublicMediaComposition;
  fallbackSrc?: ImageProps["src"] | null;
};

export function resolvePublicMediaComposition(value: unknown): PublicMediaComposition {
  if (typeof value !== "string") return "cover-center";

  if (value in PUBLIC_MEDIA_COMPOSITIONS) {
    return value as PublicMediaComposition;
  }

  // Persisted Hero values remain backward compatible without leaking CSS to consumers.
  return value.trim() === "object-[42%_36%]" ? "cover-upper" : "cover-center";
}

function getCompositionStyle(composition: PublicMediaComposition) {
  return PUBLIC_MEDIA_COMPOSITIONS[composition];
}

/** Shared public renderer, failure behavior, and Image Composition owner. */
export default function PublicMediaImage({
  src,
  alt,
  composition: compositionInput,
  fallbackSrc = PUBLIC_MEDIA_IMAGE_FALLBACK,
  onError,
  style,
  ...props
}: PublicMediaImageProps) {
  const composition = compositionInput
    ? resolvePublicMediaComposition(compositionInput)
    : undefined;
  const sourceKey = typeof src === "string" ? src : "default" in src ? src.default.src : src.src;
  const [failedSourceKey, setFailedSourceKey] = useState<string | null>(null);
  const failed = failedSourceKey === sourceKey;

  if (failed && fallbackSrc == null) return null;

  return (
    <Image
      {...props}
      src={failed ? fallbackSrc! : src}
      alt={alt}
      data-public-media-composition={composition}
      style={composition ? { ...style, ...getCompositionStyle(composition) } : style}
      onError={(event) => {
        if (!failed) setFailedSourceKey(sourceKey);
        onError?.(event);
      }}
    />
  );
}

type PublicArtDirectedMediaImageProps = {
  desktopSrc: string;
  mobileSrc?: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  style?: React.CSSProperties;
  composition?: PublicMediaComposition;
  fallbackSrc?: ImageProps["src"];
};

const TRANSPARENT_IMAGE_FALLBACK =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

/** Art-directed public image renderer; composition still resolves through this owner. */
export function PublicArtDirectedMediaImage({
  desktopSrc,
  mobileSrc,
  alt,
  priority = false,
  sizes = "100vw",
  className,
  style,
  composition = "cover-center",
  fallbackSrc = PUBLIC_MEDIA_IMAGE_FALLBACK,
}: PublicArtDirectedMediaImageProps) {
  const sourceKey = `${desktopSrc}\n${mobileSrc ?? ""}`;
  const [failedSourceKey, setFailedSourceKey] = useState<string | null>(null);
  const resolvedComposition = resolvePublicMediaComposition(composition);

  if (!mobileSrc || mobileSrc === desktopSrc) {
    return (
      <PublicMediaImage
        src={desktopSrc}
        alt={alt}
        fill
        loading={priority ? "eager" : undefined}
        fetchPriority={priority ? "high" : undefined}
        sizes={sizes}
        className={className}
        style={style}
        composition={resolvedComposition}
        fallbackSrc={fallbackSrc}
      />
    );
  }

  if (failedSourceKey === sourceKey) {
    return (
      <PublicMediaImage
        src={fallbackSrc}
        alt={alt}
        fill
        loading={priority ? "eager" : undefined}
        fetchPriority={priority ? "high" : undefined}
        sizes={sizes}
        className={className}
        style={style}
        composition={resolvedComposition}
      />
    );
  }

  const common = {
    alt,
    sizes,
    fill: true as const,
    fetchPriority: priority ? ("high" as const) : ("auto" as const),
    loading: priority ? ("eager" as const) : ("lazy" as const),
  };
  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({ ...common, src: desktopSrc });
  const {
    props: { srcSet: mobileSrcSet, ...mobileRest },
  } = getImageProps({ ...common, src: mobileSrc });

  return (
    <picture>
      <source media="(max-width: 767px)" srcSet={mobileSrcSet} sizes={sizes} />
      <source media="(min-width: 768px)" srcSet={desktopSrcSet} sizes={sizes} />
      <img
        {...mobileRest}
        src={TRANSPARENT_IMAGE_FALLBACK}
        alt={alt}
        className={className}
        data-public-media-composition={resolvedComposition}
        style={{ ...mobileRest.style, ...style, ...getCompositionStyle(resolvedComposition) }}
        onError={() => setFailedSourceKey(sourceKey)}
      />
    </picture>
  );
}
