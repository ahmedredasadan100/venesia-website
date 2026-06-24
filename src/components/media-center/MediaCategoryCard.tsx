import Link from "next/link";

type MediaCategoryCardProps = {
  title: string;
  href: string;
  eyebrow: string;
  description: string;
  image: string;
};

export default function MediaCategoryCard({
  title,
  href,
  eyebrow,
  description,
  image,
}: MediaCategoryCardProps) {
  return (
    <Link
      href={href}
      className="group relative min-h-[340px] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] shadow-[0_24px_80px_rgba(0,0,0,0.35)] transition duration-500 hover:-translate-y-1 hover:border-[#D8B87A]/35"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-105"
        style={{ backgroundImage: `url(${image})` }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/74 to-[#05070B]/18"
      />

      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-l from-transparent via-[#D8B87A]/60 to-transparent opacity-0 transition duration-500 group-hover:opacity-100"
      />

      <div className="relative z-10 flex h-full min-h-[340px] flex-col justify-end p-7">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.28em] text-[#D8B87A]/80">
          {eyebrow}
        </p>

        <h3 className="text-2xl font-semibold leading-tight text-white">
          {title}
        </h3>

        <p className="mt-4 max-w-md text-sm leading-7 text-white/64">
          {description}
        </p>

        <span className="mt-7 inline-flex w-fit items-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-2 text-xs font-medium text-white/80 transition duration-500 group-hover:border-[#D8B87A]/35 group-hover:text-[#D8B87A]">
          استكشف القسم
        </span>
      </div>
    </Link>
  );
}