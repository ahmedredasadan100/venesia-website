type ModulePageOption = {
  id: number;
  title: string;
  path: string;
};

type ModulePageAssignmentsFieldProps = {
  pages: ModulePageOption[];
  assignedPageIds: number[];
  helperText?: string;
};

export default function ModulePageAssignmentsField({
  pages,
  assignedPageIds,
  helperText = "اختر الصفحات التي تستخدم هذا الموديول. إزالة الربط هنا لا تحذف الموديول نفسه.",
}: ModulePageAssignmentsFieldProps) {
  const assignedSet = new Set(assignedPageIds);

  return (
    <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
      <h2 className="text-lg font-semibold text-white">يظهر في الصفحات</h2>
      <p className="text-sm leading-7 text-white/45">{helperText}</p>

      <div className="space-y-2">
        {pages.map((page) => (
          <label
            key={page.id}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70"
          >
            <span>
              {page.title}
              <span className="mr-2 font-mono text-xs text-white/35">{page.path}</span>
            </span>
            <input
              type="checkbox"
              name="page_ids"
              value={page.id}
              defaultChecked={assignedSet.has(page.id)}
            />
          </label>
        ))}

        {!pages.length ? <p className="text-sm text-white/45">لا توجد صفحات منشورة في النظام.</p> : null}
      </div>
    </section>
  );
}
