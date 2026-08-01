"use client";

import { AdminFeedbackRegion } from "../AdminFeedbackProvider";

export default function MediaSynchronizationWarningNotice({
  visible,
}: {
  visible: boolean;
}) {
  return (
    <AdminFeedbackRegion
      channel="media-synchronization"
      label="حالة مزامنة ارتباطات الميديا"
      feedback={
        visible
          ? {
              variant: "warning",
              title: "تعذرت مزامنة ارتباطات الميديا",
              message:
                "تم حفظ البيانات، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الإصلاح أو الفحص.",
              layout: "stacked",
              dismissible: true,
              lifecycle: "persistent",
              dismissSearchParams: ["notice"],
            }
          : null
      }
    />
  );
}
