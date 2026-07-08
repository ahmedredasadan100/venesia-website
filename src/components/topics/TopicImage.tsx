"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";
import { logWarn } from "../../lib/logging";

function normalizeTopicImageSrc(src: ImageProps["src"]) {
  if (src == null) return null;
  if (typeof src === "string") {
    const trimmed = src.trim();
    return trimmed ? trimmed : null;
  }
  return src;
}

export default function TopicImage({ alt = "", ...props }: ImageProps) {
  const [failed, setFailed] = useState(false);
  const normalizedSrc = normalizeTopicImageSrc(props.src);

  if (failed || normalizedSrc == null) {
    return null;
  }

  return (
    <Image
      {...props}
      alt={alt}
      src={normalizedSrc}
      onError={() => {
        logWarn("Topic image failed to load", { src: String(props.src) });
        setFailed(true);
      }}
    />
  );
}