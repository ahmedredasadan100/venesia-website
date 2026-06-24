"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";
import { logWarn } from "../../lib/logging";

export default function TopicImage(props: ImageProps) {
  const [src, setSrc] = useState(props.src);

  return (
    <Image
      {...props}
      src={src}
      onError={() => {
        logWarn("Topic image failed to load", { src: String(props.src) });
        setSrc("/images/topics/default.jpg");
      }}
    />
  );
}