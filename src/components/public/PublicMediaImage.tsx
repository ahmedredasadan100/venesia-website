"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

export const PUBLIC_MEDIA_IMAGE_FALLBACK = "/images/venesia-5.png";

type PublicMediaImageProps = ImageProps & {
  fallbackSrc?: string;
};

/** Shared public image failure presentation for media-backed surfaces. */
export default function PublicMediaImage({
  src,
  alt,
  fallbackSrc = PUBLIC_MEDIA_IMAGE_FALLBACK,
  onError,
  ...props
}: PublicMediaImageProps) {
  const sourceKey = typeof src === "string" ? src : "default" in src ? src.default.src : src.src;
  const [failedSourceKey, setFailedSourceKey] = useState<string | null>(null);
  const failed = failedSourceKey === sourceKey;

  return (
    <Image
      {...props}
      src={failed ? fallbackSrc : src}
      alt={alt}
      onError={(event) => {
        if (!failed) setFailedSourceKey(sourceKey);
        onError?.(event);
      }}
    />
  );
}
