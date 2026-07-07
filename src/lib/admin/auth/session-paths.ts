export function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isAdminApiPath(pathname: string) {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

export function isAdminAuthPagePath(pathname: string) {
  return pathname === "/admin/login" || pathname === "/admin/forgot-password";
}

export function isAdminAuthPublicPath(pathname: string) {
  return (
    isAdminAuthPagePath(pathname) ||
    pathname === "/api/admin/auth/login" ||
    pathname === "/api/admin/auth/logout"
  );
}
