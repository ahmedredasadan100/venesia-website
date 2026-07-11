import { type ProjectHubFilterId } from "../../lib/projects/public-types";

type ProjectsHubFiltersProps = {
  activeFilter: ProjectHubFilterId;
  onFilterChange: (filter: ProjectHubFilterId) => void;
  stats: {
    total: number;
    residential: number;
    commercial: number;
  };
  visibleFilters?: ProjectHubFilterId[];
};

const ALL_FILTERS: Array<{
  id: ProjectHubFilterId;
  label: string;
  getCount: (stats: ProjectsHubFiltersProps["stats"]) => number;
}> = [
  {
    id: "all",
    label: "كل المشروعات",
    getCount: (stats) => stats.total,
  },
  {
    id: "residential",
    label: "سكني",
    getCount: (stats) => stats.residential,
  },
  {
    id: "commercial",
    label: "تجاري",
    getCount: (stats) => stats.commercial,
  },
];

export default function ProjectsHubFilters({
  activeFilter,
  onFilterChange,
  stats,
  visibleFilters,
}: ProjectsHubFiltersProps) {
  const filters = visibleFilters?.length
    ? ALL_FILTERS.filter((filter) => visibleFilters.includes(filter.id))
    : ALL_FILTERS;

  return (
    <section className="relative mt-0">
      <div className="mx-auto max-w-7xl rounded-2xl border border-[#D8B87A]/15 bg-[#080B10]/90 p-3 shadow-[0_22px_70px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-nowrap gap-1 md:flex-wrap md:gap-2">
            {filters.map((filter) => {
              const isActive = activeFilter === filter.id;
              const count = filter.getCount(stats);

              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => onFilterChange(filter.id)}
                  className={`flex min-w-0 flex-1 basis-0 items-center justify-center gap-0.5 whitespace-nowrap rounded-xl border px-1 py-2.5 text-[10px] leading-none transition duration-300 sm:gap-1 sm:px-1.5 sm:text-[11px] md:flex-none md:basis-auto md:min-w-[120px] md:gap-0 md:px-5 md:py-3 md:text-sm ${
                    isActive
                      ? "border-[#D8B87A] bg-[#D8B87A] text-[#111]"
                      : "border-white/10 bg-white/[0.03] text-white/70 hover:border-[#D8B87A]/45 hover:text-white"
                  }`}
                >
                  <span>{filter.label}</span>

                  <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-black/20 px-1 text-[10px] md:mr-2 md:h-5 md:min-w-5 md:px-1.5 md:text-[11px]">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onFilterChange("all")}
            className="w-full rounded-xl border border-[#D8B87A]/20 px-5 py-3 text-sm text-[#D8B87A] transition duration-300 hover:border-[#D8B87A]/55 hover:bg-[#D8B87A]/10 md:w-auto"
          >
            إعادة تعيين الفلاتر
          </button>
        </div>
      </div>
    </section>
  );
}
