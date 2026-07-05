import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_COLUMNS,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridCenterCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridPrimaryCell,
  AdminDataGridRow,
  AdminDataGridStatusCell,
  AdminInfoBar,
  AdminPageContextHeader,
  AdminStatusPill,
  AdminActionButton,
} from "../../../../components/admin/ui";
import { formatAdminListDate } from "../../../../lib/content-dates";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import {
  getContentTypeLabel,
  isPhase3BEditableContentType,
  MEDIA_LIST_CONTENT_TYPES,
  type MediaListContentType,
} from "./media-content-config";

export const dynamic = "force-dynamic";

type MediaTopicRow = {
  id: number;
  title: string | null;
  slug: string | null;
  content_type: MediaListContentType | string | null;
  category: string | null;
  category_slug: string | null;
  status: string | null;
  is_featured: boolean | null;
  updated_at: string | null;
};

/** Date column width — matches Topics list published/updated column (125px). */
const MEDIA_GRID_COLUMNS = `${ADMIN_DATA_GRID_COLUMNS.primaryStandard} ${ADMIN_DATA_GRID_COLUMNS.slugCompact} ${ADMIN_DATA_GRID_COLUMNS.slug} ${ADMIN_DATA_GRID_COLUMNS.statusStandard} ${ADMIN_DATA_GRID_COLUMNS.count} 125px ${ADMIN_DATA_GRID_ACTION_COLUMNS.one}`;

function getStatusTone(status?: string | null): "green" | "gold" | "muted" | "red" {
  if (status === "published") return "green";
  if (status === "unpublished") return "red";
  if (status === "archived") return "muted";
  return "gold";
}

function getStatusLabel(status?: string | null) {
  if (status === "published") return "منشور";
  if (status === "unpublished") return "مخفي";
  if (status === "archived") return "أرشيف";
  return "مسودة";
}

export default async function AdminUnifiedMediaContentPage() {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("id, title, slug, content_type, category, category_slug, status, is_featured, updated_at")
    .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  const rows = (data ?? []) as MediaTopicRow[];
  const publishedCount = rows.filter((row) => row.status === "published").length;
  const featuredCount = rows.filter((row) => row.is_featured).length;

  return (
    <main className="space-y-7">
      <AdminPageContextHeader
        eyebrow="UNIFIED MEDIA CONTENT"
        title="محتوى المركز الإعلامي"
        description="قائمة المحتوى الإعلامي الجديد من جدول topics فقط. هذه الواجهة إدارية بالتوازي مع النظام القديم — لا تؤثر على الواجهة العامة أو media_items."
        actions={
          <>
            <AdminActionButton href="/admin/content/media/new" variant="primary">
              <PlusIcon />
              إضافة محتوى جديد
            </AdminActionButton>
            <AdminActionButton href="/admin/topics" variant="dark">
              عرض المقالات
            </AdminActionButton>
            <AdminActionButton href="/admin/topics/categories" variant="dark">
              عرض التصنيفات
            </AdminActionButton>
          </>
        }
      />

      <AdminInfoBar
        label="Phase 3B — Create / Edit"
        description="إنشاء وتعديل news / press / site_update داخل topics. video و gallery للمرحلة التالية."
        meta={`${rows.length} Items / ${publishedCount} Published / ${featuredCount} Featured`}
      />

      {error ? (
        <AdminNotice variant="danger" title="تعذر تحميل المحتوى الإعلامي" message={error.message} />
      ) : null}

      <AdminDataGrid
        summary={
          rows.length > 0
            ? `عرض ${rows.length} عنصرًا — مصدر البيانات: topics (${MEDIA_LIST_CONTENT_TYPES.join(", ")})`
            : undefined
        }
      >
        <AdminDataGridHeader columns={MEDIA_GRID_COLUMNS}>
          <span className="text-right">العنوان</span>
          <span className="text-center">نوع المحتوى</span>
          <span className="text-center">التصنيف</span>
          <span className="text-center">الحالة</span>
          <span className="text-center">مميز</span>
          <span className="text-center">آخر تحديث</span>
          <span className="text-center">الإجراءات</span>
        </AdminDataGridHeader>

        {rows.length > 0 ? (
          rows.map((row, index) => (
            <AdminDataGridRow key={row.id} columns={MEDIA_GRID_COLUMNS} divided={index > 0}>
              <AdminDataGridPrimaryCell>
                <div className="space-y-1">
                  <h3 className="truncate text-base font-bold text-white">{row.title || "بدون عنوان"}</h3>
                  {row.slug ? <p className="truncate font-en text-xs text-white/35">{row.slug}</p> : null}
                </div>
              </AdminDataGridPrimaryCell>

              <AdminDataGridCenterCell>
                <span className="text-sm text-white/72">{getContentTypeLabel(row.content_type)}</span>
              </AdminDataGridCenterCell>

              <AdminDataGridCenterCell>
                <span className="truncate text-sm text-white/72">{row.category || "—"}</span>
              </AdminDataGridCenterCell>

              <AdminDataGridStatusCell>
                <AdminStatusPill tone={getStatusTone(row.status)}>{getStatusLabel(row.status)}</AdminStatusPill>
              </AdminDataGridStatusCell>

              <AdminDataGridCenterCell>
                <span className="font-en text-sm text-white/62">{row.is_featured ? "نعم" : "—"}</span>
              </AdminDataGridCenterCell>

              <AdminDataGridCenterCell>
                <span className="font-en text-sm text-white/62">{formatAdminListDate(row.updated_at)}</span>
              </AdminDataGridCenterCell>

              <AdminDataGridActionsCell>
                {isPhase3BEditableContentType(row.content_type) ? (
                  <AdminDataGridActionButton action="edit" href={`/admin/content/media/${row.id}`} title="تعديل" />
                ) : (
                  <AdminDataGridActionButton action="edit" disabled title="التعديل غير متاح لهذا النوع في Phase 3B" />
                )}
              </AdminDataGridActionsCell>
            </AdminDataGridRow>
          ))
        ) : (
          <AdminDataGridEmpty>
            لا يوجد محتوى إعلامي في topics بعد. أنشئ عنصرًا جديدًا من «إضافة محتوى جديد» للأقسام: الأخبار، البيانات الصحفية، من أرض التنفيذ.
          </AdminDataGridEmpty>
        )}
      </AdminDataGrid>
    </main>
  );
}
