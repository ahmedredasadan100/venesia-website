import Image from "next/image";
import type { ContactDepartmentsContent } from "./contact-cms-mappers";

type ContactDepartmentsSectionProps = {
  cmsContent: ContactDepartmentsContent | null;
};

export default function ContactDepartmentsSection({ cmsContent }: ContactDepartmentsSectionProps) {
  if (!cmsContent || (!cmsContent.items.length && !cmsContent.title.trim())) return null;

  const departments = cmsContent;

  return (
    <section className="mx-auto max-w-7xl px-5 pb-8 sm:px-8 lg:px-10">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-7">
        {departments.title.trim() ? (
          <h2 className="text-center text-2xl font-semibold text-[#d2a75a]">
            {departments.title}
          </h2>
        ) : null}

        <div className={`grid gap-4 md:grid-cols-3 ${departments.title.trim() ? "mt-7" : ""}`}>
          {departments.items.map((item) => (
            <div
              key={item.title}
              className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 transition duration-300 hover:-translate-y-1 hover:border-[#d2a75a]/35"
            >
              {item.image ? (
                <div className="relative h-44">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 400px"
                    className="object-cover opacity-75"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#03070b] to-transparent" />
                </div>
              ) : null}

              <div className="p-6">
                <h3 className="font-semibold">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-white/60">
                  {item.text}
                </p>

                <span className="mt-5 inline-block text-sm text-[#d2a75a]">
                  تواصل مع القسم
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
