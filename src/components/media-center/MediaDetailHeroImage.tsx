import Image from "next/image";

import type { MediaDetailHeroVariant } from "../../lib/media-center/detail-page-config";

type MediaDetailHeroImageProps = {
  src: string;
  alt: string;
  variant: MediaDetailHeroVariant;
};

const HERO_HEIGHT_CLASS: Record<MediaDetailHeroVariant, string> = {
  default: "h-[420px]",
  gallery: "h-[500px]",
  video: "h-[420px]",
};

export default function MediaDetailHeroImage({ src, alt, variant }: MediaDetailHeroImageProps) {
  const isVideo = variant === "video";

  return (
    <div
      className={`${isVideo ? "group " : ""}relative overflow-hidden rounded-[2rem] border border-white/10 ${HERO_HEIGHT_CLASS[variant]}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority
        sizes="(min-width: 1024px) 900px, 100vw"
        className={`object-cover${isVideo ? " transition duration-700 group-hover:scale-105" : ""}`}
      />

      <div
        aria-hidden="true"
        className={
          isVideo
            ? "absolute inset-0 bg-gradient-to-t from-[#05070B]/75 via-[#05070B]/15 to-transparent"
            : "absolute inset-0 bg-gradient-to-t from-[#05070B]/55 via-transparent to-transparent"
        }
      />

      {isVideo ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#D8B87A]/40 bg-black/45 backdrop-blur-md transition duration-500 group-hover:scale-105 group-hover:bg-[#D8B87A]/15">
            <span className="mr-[-4px] block h-0 w-0 border-y-[12px] border-r-0 border-l-[18px] border-y-transparent border-l-[#D8B87A]" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
