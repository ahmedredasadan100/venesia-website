import { type ProjectHubFilterId } from "../../lib/projects/public-types";

type ProjectsHubFiltersProps = {
  activeFilter: ProjectHubFilterId;
  onFilterChange: (filter: ProjectHubFilterId) => void;
  stats: {
    total: number;
    residential: number;
    commercial: number;
  };
};

const visibleFilters: Array<{
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
}: ProjectsHubFiltersProps) {
  return (
    <section className="relative z-20 mt-0">
      <div className="mx-auto max-w-7xl rounded-2xl border border-[#D8B87A]/15 bg-[#080B10]/90 p-3 shadow-[0_22px_70px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {visibleFilters.map((filter) => {
              const isActive = activeFilter === filter.id;
              const count = filter.getCount(stats);

              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => onFilterChange(filter.id)}
                  className={`min-w-[120px] rounded-xl border px-5 py-3 text-sm transition duration-300 ${
                    isActive
                      ? "border-[#D8B87A] bg-[#D8B87A] text-[#111]"
                      : "border-white/10 bg-white/[0.03] text-white/70 hover:border-[#D8B87A]/45 hover:text-white"
                  }`}
                >
                  <span>{filter.label}</span>

                  <span className="mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-black/20 px-1.5 text-[11px]">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onFilterChange("all")}
            className="rounded-xl border border-[#D8B87A]/20 px-5 py-3 text-sm text-[#D8B87A] transition duration-300 hover:border-[#D8B87A]/55 hover:bg-[#D8B87A]/10"
          >
            إعادة تعيين الفلاتر
          </button>
        </div>
      </div>
    </section>
  );
}