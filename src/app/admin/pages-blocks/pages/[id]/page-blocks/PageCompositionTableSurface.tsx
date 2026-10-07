import type { ReactNode } from "react";
import {
  AdminEntityListPrimarySection,
  AdminEntityListTableFrame,
  AdminEntityListTableRegion,
} from "../../../../../../components/admin/entity-list/AdminEntityListSurface";

type PageCompositionTableSurfaceProps = {
  feedback: ReactNode;
  toolbar: ReactNode;
  table: ReactNode;
  pagination: ReactNode;
};

/** One presentation boundary for the Page Composition toolbar and data table. */
export default function PageCompositionTableSurface({
  feedback,
  toolbar,
  table,
  pagination,
}: PageCompositionTableSurfaceProps) {
  return (
    <AdminEntityListTableRegion dir="rtl" data-page-composition-table-surface="">
      {feedback}
      <AdminEntityListTableFrame toolbar={toolbar}>
        <AdminEntityListPrimarySection>{table}</AdminEntityListPrimarySection>
      </AdminEntityListTableFrame>
      {pagination}
    </AdminEntityListTableRegion>
  );
}
