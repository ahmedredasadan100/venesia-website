import {
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../components/admin/ui";
import { normalizeAdminEntityListQuery } from "../../../../lib/admin/entity-list/data-engine/contracts";
import { loadTopicsWithoutImageEntityListResult } from "../../../../lib/admin/media-catalog/topics-without-image-entity-list-adapter";
import { topicsWithoutImageQueryContract } from "../../../../lib/admin/media-catalog/topics-without-image-entity-list-contract";
import { TOPICS_WITHOUT_IMAGE_LIST_VIEW_KEY } from "../../../../lib/admin/media-catalog/topics-without-image-list-config";
import { readAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";

import TopicsWithoutImageReportClient from "./TopicsWithoutImageReportClient";

export const dynamic = "force-dynamic";

export default async function TopicsWithoutImageReportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const params = new URLSearchParams();
  Object.entries(resolved).forEach(([key, value]) => {
    if (typeof value === "string") params.set(key, value);
  });
  const query = normalizeAdminEntityListQuery(
    topicsWithoutImageQueryContract,
    params,
  );
  const [result, columnPreferences] = await Promise.all([
    loadTopicsWithoutImageEntityListResult(query),
    readAdminColumnPreferences(TOPICS_WITHOUT_IMAGE_LIST_VIEW_KEY),
  ]);

  return (
    <AdminPageExperience className="pb-10">
      <AdminPageContextHeader
        eyebrow="MEDIA QUALITY REPORT"
        title="الموضوعات بلا صورة"
        description="تقرير قابل للتصفية للموضوعات النشطة وغير المحذوفة التي لا ترتبط بصورة. هذا تقرير جودة، وليس دليلًا على أمان حذف أي أصل."
      />
      <TopicsWithoutImageReportClient
        initialQuery={query}
        initialResult={result}
        initialVisibleColumns={columnPreferences.visibleColumns}
      />
    </AdminPageExperience>
  );
}
