import { AdminActionButton, AdminInfoBar, AdminPageContextHeader } from "../../../../../components/admin/ui";
import { loadActiveTopicCategoriesForAdmin } from "../../../../../lib/admin/load-topic-categories";
import SeriesForm from "../SeriesForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  const categories = await loadActiveTopicCategoriesForAdmin();

  return (
    <main className="space-y-7">
      <AdminPageContextHeader
        eyebrow="SERIES CONTROL"
        title="إضافة سلسلة جديدة"
        description="أضف سلسلة جديدة تحت تصنيف محدد ليتم اختيارها لاحقًا من داخل الموضوعات."
        actions={
          <>
            <AdminActionButton href="/admin/topics" variant="dark">عرض المقالات</AdminActionButton>
            <AdminActionButton href="/admin/topics/categories" variant="dark">عرض التصنيفات</AdminActionButton>
            <AdminActionButton href="/admin/content/series" variant="dark">عرض السلاسل</AdminActionButton>
          </>
        }
      />
      <AdminInfoBar label="Series Create" description="كل سلسلة يجب أن تنتمي إلى تصنيف من Topics Categories." />
      <SeriesForm mode="create" categories={categories} />
    </main>
  );
}
