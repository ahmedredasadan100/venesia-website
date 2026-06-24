import Link from "next/link";

import { type PublicProject } from "../../../lib/projects/public-types";
import PlainTextContent from "../../content/PlainTextContent";

type ProjectDetailsHeroProps = {
  project: PublicProject;
};

export default function ProjectDetailsHero({ project }: ProjectDetailsHeroProps) {
  return (
    <section className="relative isolate min-h-[620px] overflow-hidden border-b border-[#D8B87A]/15 bg-[#05070B]">
      <img
        src={project.heroImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-55"
      />

      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_left,rgba(5,7,11,0.96)_0%,rgba(5,7,11,0.80)_35%,rgba(5,7,11,0.40)_62%,rgba(5,7,11,0.86)_100%)]"
      />

      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_70%_24%,rgba(216,184,122,0.18),transparent_62%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-[620px] max-w-7xl items-end px-6 pb-16 pt-32">
        <div className="grid w-full items-end gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="mb-5 text-center font-en text-[11px] uppercase tracking-[0.28em] text-[#D8B87A]/70 lg:text-right">
              {project.locationLabel}
            </p>

            <div className="text-center lg:text-right">
              <h1 className="font-en text-6xl font-semibold leading-none text-[#D8B87A] md:text-8xl">
                {project.code}
              </h1>

              <h2 className="mt-3 text-3xl font-semibold leading-tight text-white md:text-4xl">
                {project.arabicName}
              </h2>
            </div>

            <PlainTextContent
              value={project.shortDescription}
              as="p"
              className="mx-auto mt-4 max-w-2xl text-center text-[15px] leading-7 text-white/62 lg:mx-0 lg:text-right"
            />

            <div className="mt-9 flex flex-wrap justify-center gap-4 lg:justify-start">
              {project.brochureUrl ? (
                <Link
                  href={project.brochureUrl}
                  className="inline-flex items-center gap-3 rounded-xl bg-[#D8B87A] px-7 py-3.5 text-sm font-medium text-[#111] transition hover:bg-[#e5c989]"
                >
                  <DownloadIcon />
                  حمّل ملف المشروع
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center gap-3 rounded-xl bg-[#D8B87A]/55 px-7 py-3.5 text-sm font-medium text-[#111]/70"
                >
                  <DownloadIcon />
                  حمّل ملف المشروع
                </button>
              )}

              <Link
                href="/contact"
                className="inline-flex items-center gap-3 rounded-xl border border-[#D8B87A]/35 px-7 py-3.5 text-sm text-[#D8B87A] transition hover:border-[#D8B87A]/70 hover:bg-[#D8B87A]/10"
              >
                <ReserveIcon />
                احجز وحدتك الآن
              </Link>
            </div>
          </div>

          <div className="hidden justify-end lg:flex">
            <div className="w-[420px] rounded-[28px] border border-[#D8B87A]/20 bg-black/24 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <div className="relative overflow-hidden rounded-[22px]">
                <img
                  src={project.image}
                  alt={project.code}
                  className="h-[280px] w-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#05070B]/90 via-transparent to-transparent" />

                <div className="absolute bottom-5 right-5">
                  <p className="font-en text-4xl font-semibold text-[#D8B87A]">
                    {project.code}
                  </p>

                  <p className="mt-1 text-sm text-white/75">
                    {project.arabicName}
                  </p>
                </div>
              </div>

              <div className="mt-5 border-t border-[#D8B87A]/15 pt-5">
                <PlainTextContent
                  value={project.shortDescription}
                  as="p"
                  className="text-sm leading-7 text-white/58"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M12 4v10M8 10l4 4 4-4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20h14" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ReserveIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 4v3M17 4v3M5 8h14M6 5h12a1 1 0 0 1 1 1v13H5V6a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}
