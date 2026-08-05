import type { ProjectCategory } from "../../../lib/projects/public-types";
import { PlusIcon } from "../../../components/admin/AdminRowActions";
import { AdminActionButton } from "../../../components/admin/ui";

export default function AddProjectPanelClient({ type }: { type: ProjectCategory }) {
  return (
    <AdminActionButton href={`/admin/projects/new?type=${type}`} variant="primary">
      <PlusIcon />
      إضافة مشروع
    </AdminActionButton>
  );
}
