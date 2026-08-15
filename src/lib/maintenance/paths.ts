

export function isPwaAssetPath(pathname: string) {
  return (
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/apple-touch-icon.png" ||
    pathname.startsWith("/icons/")
  );
}

export function isMaintenancePublicPath(pathname: string) {
  return (
    pathname === "/maintenance" ||
    pathname === "/api/maintenance/login" ||
    isPwaAssetPath(pathname)
  );
}
