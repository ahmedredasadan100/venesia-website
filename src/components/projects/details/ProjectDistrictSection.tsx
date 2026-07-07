import RichTextContent from "../../content/RichTextContent";
import PlainTextContent from "../../content/PlainTextContent";

type DistrictProfile = {
  title: string;
  subtitle?: string;
  body: string;
  bullets: string[];
  image: string;
};

type ProjectDistrictSectionProps = {
  districtProfile?: DistrictProfile;
  projectCode?: string;
};

export default function ProjectDistrictSection({
  districtProfile,
  projectCode,
}: ProjectDistrictSectionProps) {
  if (!districtProfile) return null;

  return (
    <section
      id="district"
      className="scroll-mt-24 border-b border-white/10 bg-[#05070B] px-6 py-16"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_0.9fr]">
        <div className="order-2 lg:order-1">
          <p className="mb-3 text-sm font-medium tracking-[0.28em] text-[#D8B87A]/70">
            عن الموقع
          </p>

          <h2 className="text-3xl font-semibold leading-tight text-[#D8B87A] md:text-4xl">
            {districtProfile.title}
          </h2>

          {districtProfile.subtitle ? (
            <PlainTextContent
              value={districtProfile.subtitle}
              as="p"
              className="mt-3 text-base text-white/70"
            />
          ) : null}

          <RichTextContent
            value={districtProfile.body}
            mode="rich"
            className="mt-6 max-w-2xl text-sm leading-8 text-white/62"
          />
        </div>

        <div className="order-1 lg:order-2">
          <div className="relative min-h-[360px] overflow-hidden rounded-[30px] border border-[#D8B87A]/20 bg-white/[0.025] shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
            <img
              src={districtProfile.image}
              alt={districtProfile.title}
              loading="lazy"
              decoding="async"
              className="h-full min-h-[360px] w-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#05070B]/80 via-[#05070B]/20 to-transparent" />

            <div className="absolute bottom-5 right-5 rounded-2xl border border-[#D8B87A]/25 bg-[#05070B]/75 px-5 py-4 backdrop-blur-md">
              <p className="text-xs tracking-[0.22em] text-[#D8B87A]/70">
                VENESIA DEVELOPMENTS
              </p>

              {projectCode ? (
                <p className="mt-1 font-en text-xl font-semibold text-white">
                  {projectCode}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
