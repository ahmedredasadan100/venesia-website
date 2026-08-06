import { useEffect } from "react";

import {
  getHubFilterOptionsFromProjects,
  getProjectStats,
  type HubFilterOption,
} from "../../lib/projects/public-helpers";
import { type ProjectHubFilterId, type PublicProject } from "../../lib/projects/public-types";

type ProjectsHubFiltersProps = {
  activeFilter: ProjectHubFilterId;
  onFilterChange: (filter: ProjectHubFilterId) => void;
  /** Full loaded projects array — filter chips are derived from present categories. */
  allProjects: PublicProject[];
};

function countForFilter(option: HubFilterOption, stats: ReturnType<typeof getProjectStats>) {
  if (option.id === "all") return stats.total;
  if (option.id === "residential") return stats.residential;
  if (option.id === "commercial") return stats.commercial;
  return 0;
}

export default function ProjectsHubFilters({
  activeFilter,
  onFilterChange,
  allProjects,
}: ProjectsHubFiltersProps) {
  const stats = getProjectStats(allProjects);
  const filters = getHubFilterOptionsFromProjects(allProjects);

  useEffect(() => {
    const options = getHubFilterOptionsFromProjects(allProjects);
    if (options.some((filter) => filter.id === activeFilter)) return;
    onFilterChange("all");
  }, [activeFilter, allProjects, onFilterChange]);

  return (
    <section className="relative mt-0">
      <div className="mx-auto max-w-7xl rounded-2xl border border-[#D8B87A]/15 bg-[#080B10]/90 p-3 shadow-[0_22px_70px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-nowrap gap-1 md:flex-wrap md:gap-2">
            {filters.map((filter) => {
              const isActive = activeFilter === filter.id;
              const count = countForFilter(filter, stats);

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
        </div>
      </div>
    </section>
  );
}
