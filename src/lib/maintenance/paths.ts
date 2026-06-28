export function isMaintenancePath(pathname: string) {
  return pathname === "/maintenance" || pathname.startsWith("/maintenance/");
}

export function isMaintenanceApiPath(pathname: string) {
  return pathname === "/api/maintenance" || pathname.startsWith("/api/maintenance/");
}

export function isPwaAssetPath(pathname: string) {
  return (
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
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
