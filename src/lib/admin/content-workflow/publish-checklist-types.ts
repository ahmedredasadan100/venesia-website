export type PublishChecklistStatus = "pass" | "warn" | "fail" | "info";

export type PublishChecklistItem = {
  id: string;
  label: string;
  status: PublishChecklistStatus;
  hint: string;
};

export function countChecklistStatus(items: PublishChecklistItem[], status: PublishChecklistStatus) {
  return items.filter((item) => item.status === status).length;
}

export function isPublishChecklistReady(items: PublishChecklistItem[]) {
  return !items.some((item) => item.status === "fail");
}
