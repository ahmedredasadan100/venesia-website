import { AdminInfoBar, AdminPageHeader } from "../../../../../components/admin/ui";
import { loadActiveTopicCategoriesForAdmin } from "../../../../../lib/admin/load-topic-categories";
import SeriesForm from "../SeriesForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  const categories = await loadActiveTopicCategoriesForAdmin();

  return (
    <main className="space-y-7">
      <AdminPageHeader title="إضافة سلسلة" description="أضف سلسلة جديدة تحت تصنيف محدد ليتم اختيارها لاحقًا من داخل الموضوعات." />
      <AdminInfoBar label="Series Create" description="كل سلسلة يجب أن تنتمي إلى تصنيف من Topics Categories." />
      <SeriesForm mode="create" categories={categories} />
    </main>
  );
}
