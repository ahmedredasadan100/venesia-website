import type { ReactNode } from "react";
import TopicDateLabelField from "./TopicDateLabelField";
import TopicFormSwitch from "./TopicFormSwitch";

export default function TopicPublishingOptions({
  status,
  featured = false,
  popular = false,
  publishedAt,
  dateLabel,
  children,
}: {
  status?: string;
  featured?: boolean;
  popular?: boolean;
  publishedAt?: string | null;
  dateLabel?: string | null;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#080B10]/92 p-5" data-topic-publishing-options>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-white">إجراءات النشر</h3><p className="mt-1 text-xs text-white/40">تستخدم نفس Server Actions وقواعد الصلاحيات الحالية.</p></div>{status ? <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55">الحالة: {status}</span> : null}</div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1.3fr)_minmax(0,1.3fr)] lg:items-stretch" data-topic-publishing-actions-row>
        <TopicFormSwitch name="is_featured" label="موضوع مميز" defaultChecked={featured} surface />
        <TopicFormSwitch name="is_popular" label="موضوع شائع" defaultChecked={popular} surface />
        <TopicDateLabelField defaultValue={dateLabel} publishedAt={publishedAt} />
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
