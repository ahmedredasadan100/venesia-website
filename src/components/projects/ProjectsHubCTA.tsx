import Link from "next/link";

export default function ProjectsHubCTA() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[30px] border border-[#D8B87A]/20 bg-[#080B10]">
        <div className="grid items-center gap-5 lg:grid-cols-[1fr_0.8fr]">
          <div className="p-8 md:p-12">
            <p className="text-sm text-[#D8B87A]/80">قرارك يبدأ من رؤية واضحة</p>

            <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-[1.4] text-white md:text-4xl">
              اختر المشروع اللي يناسب خطتك
              <span className="block text-[#D8B87A]">
                وشوف التنفيذ قبل القرار
              </span>
            </h2>

            <p className="mt-5 max-w-xl text-sm leading-7 text-white/55">
              فينيسيا لا تعرض مشروعًا فقط، بل تعرض مسار تنفيذ واضح، وموقعًا
              مدروسًا، وثقة تُرى على الأرض.
            </p>

            <Link
              href="/contact"
              className="mt-8 inline-flex rounded-xl bg-[#D8B87A] px-8 py-4 text-sm font-medium text-[#111] transition duration-300 hover:bg-[#e7c985]"
            >
              تواصل معنا الآن
            </Link>
          </div>

          <div className="relative min-h-[260px]">
            <img
              src="/images/cta-building-night.png"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#080B10]" />
          </div>
        </div>
      </div>
    </section>
  );
}