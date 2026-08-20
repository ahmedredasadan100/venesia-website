import { AdminCheckbox, AdminFormSection } from "../ui";

type ModulePageOption = {
  id: number;
  title: string;
  path: string;
};

type ModulePageAssignmentsFieldProps = {
  pages: ModulePageOption[];
  assignedPageIds: number[];
};

export default function ModulePageAssignmentsField({
  pages,
  assignedPageIds,
}: ModulePageAssignmentsFieldProps) {
  const assignedSet = new Set(assignedPageIds);

  return (
    <AdminFormSection variant="module">
      <div className="space-y-2">
        {pages.map((page) => (
          <label
            key={page.id}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70"
          >
            <span>
              {page.title}
              <span className="mr-2 font-mono text-xs text-white/35">
                {page.path}
              </span>
            </span>
            <AdminCheckbox
              name="page_ids"
              value={page.id}
              defaultChecked={assignedSet.has(page.id)}
              label={`ربط ${page.title}`}
            />
          </label>
        ))}

        {!pages.length ? (
          <p className="text-sm text-white/45">
            لا توجد صفحات منشورة في النظام.
          </p>
        ) : null}
      </div>
    </AdminFormSection>
  );
}
