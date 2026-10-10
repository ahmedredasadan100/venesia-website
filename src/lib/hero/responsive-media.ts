/** Manual Hero sources are independent lists; only an empty mobile list falls back. */
export function resolveHeroResponsiveMedia(
  desktopImages: readonly string[] = [],
  mobileImages: readonly string[] = [],
) {
  return {
    desktop: desktopImages,
    mobile: mobileImages.length ? mobileImages : desktopImages,
  };
}
