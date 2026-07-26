import AdminNotice from "../AdminNotice";

export default function MediaSynchronizationWarningNotice({
  visible,
}: {
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <AdminNotice
      variant="warning"
      message="تم حفظ البيانات، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الإصلاح أو الفحص."
    />
  );
}
