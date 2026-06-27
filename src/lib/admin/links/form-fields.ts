import type { AdminLinkValue } from "./types";

export function parseAdminLinkFromFormData(formData: FormData, prefix: string): AdminLinkValue {
  const linkKind = String(formData.get(`${prefix}_link_kind`) ?? "").trim();
  const linkedType = String(formData.get(`${prefix}_linked_type`) ?? "").trim();
  const linkedIdRaw = String(formData.get(`${prefix}_linked_id`) ?? "").trim();
  const href = String(formData.get(`${prefix}_link_href`) ?? "").trim();
  const anchor = String(formData.get(`${prefix}_link_anchor`) ?? "").trim();
  const target = String(formData.get(`${prefix}_link_target`) ?? "_self").trim();
  const routeKey = String(formData.get(`${prefix}_link_route_key`) ?? "").trim();

  if (!linkKind || linkKind === "none") {
    return { link_kind: "none", target: "_self" };
  }

  return {
    link_kind: linkKind as AdminLinkValue["link_kind"],
    linked_type: linkedType ? (linkedType as AdminLinkValue["linked_type"]) : null,
    linked_id: linkedIdRaw ? Number(linkedIdRaw) : null,
    href: href || null,
    anchor: anchor || null,
    target: target === "_blank" ? "_blank" : "_self",
    meta: routeKey ? { route_key: routeKey } : null,
  };
}

export function adminLinkHiddenInputNames(prefix: string) {
  return {
    linkKind: `${prefix}_link_kind`,
    linkedType: `${prefix}_linked_type`,
    linkedId: `${prefix}_linked_id`,
    href: `${prefix}_link_href`,
    anchor: `${prefix}_link_anchor`,
    target: `${prefix}_link_target`,
    routeKey: `${prefix}_link_route_key`,
  };
}
