import type { ContactFormContent, ContactOfficeContent } from "./contact-cms-mappers";

type ContactFormSectionProps = {
  cmsOffice: ContactOfficeContent | null;
  cmsForm: ContactFormContent | null;
};

const FORM_FIELD_LABELS = {
  name: "الاسم الكامل",
  phone: "رقم الهاتف",
  email: "البريد الإلكتروني",
  subject: "الموضوع",
  message: "رسالتك",
  privacy: "أوافق على سياسة الخصوصية",
} as const;

const FORM_SUBJECT_OPTIONS = [
  "استفسار عن مشروع",
  "حجز معاينة",
  "استشارة استثمارية",
  "خدمة العملاء",
] as const;

export default function ContactFormSection({ cmsOffice, cmsForm }: ContactFormSectionProps) {
  if (!cmsOffice && !cmsForm) return null;

  const office = cmsOffice;
  const form = cmsForm;

  return (
    <section className="mx-auto grid max-w-7xl gap-5 px-5 py-8 sm:px-8 lg:grid-cols-[0.9fr_1.6fr] lg:px-10">
      {office ? (
        <aside className="rounded-[28px] border border-white/10 bg-white/[0.035] p-7">
          <p className="text-sm font-semibold text-[#d2a75a]">Venesia Office</p>

          {office.title.trim() ? (
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {office.title}
            </h2>
          ) : null}

          {office.description.trim() ? (
            <p className="mt-4 leading-8 text-white/60">
              {office.description}
            </p>
          ) : null}

          <div className="mt-7 space-y-5 text-sm leading-7 text-white/70">
            {office.address.trim() ? <p>{office.address}</p> : null}
            {office.workingHours.trim() ? <p>{office.workingHours}</p> : null}
            {office.phone.trim() ? <p>{office.phone}</p> : null}
            {office.whatsapp.trim() ? <p>{office.whatsapp}</p> : null}
            {office.email.trim() ? <p>{office.email}</p> : null}
          </div>
        </aside>
      ) : null}

      {form ? (
        <div className="min-w-0 rounded-[28px] border border-[#d2a75a]/20 bg-white/[0.035] p-7">
          <div className="mb-7 text-center">
            {form.title.trim() ? (
              <h2 className="text-2xl font-semibold text-[#d2a75a]">
                {form.title}
              </h2>
            ) : null}

            {form.description.trim() ? (
              <p className="mx-auto mt-3 max-w-2xl leading-8 text-white/60">
                {form.description}
              </p>
            ) : null}
          </div>

          {/* Submission destination intentionally deferred — no backend yet, so the
              button stays inert to avoid a reload that falsely implies the message was sent. */}
          <form className="grid min-w-0 gap-5">
            <div className="grid min-w-0 gap-5 md:grid-cols-2">
              <input
                type="text"
                autoComplete="name"
                aria-label={FORM_FIELD_LABELS.name}
                className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-5 py-4 text-white outline-none transition placeholder:text-white/40 focus:border-[#d2a75a]/60"
                placeholder={FORM_FIELD_LABELS.name}
              />

              <input
                type="tel"
                autoComplete="tel"
                aria-label={FORM_FIELD_LABELS.phone}
                className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-5 py-4 text-white outline-none transition placeholder:text-white/40 focus:border-[#d2a75a]/60"
                placeholder={FORM_FIELD_LABELS.phone}
              />

              <input
                type="email"
                autoComplete="email"
                aria-label={FORM_FIELD_LABELS.email}
                className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-5 py-4 text-white outline-none transition placeholder:text-white/40 focus:border-[#d2a75a]/60"
                placeholder={FORM_FIELD_LABELS.email}
              />

              <select
                aria-label={FORM_FIELD_LABELS.subject}
                defaultValue=""
                className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-5 py-4 text-white outline-none transition focus:border-[#d2a75a]/60"
              >
                <option value="" disabled>
                  {FORM_FIELD_LABELS.subject}
                </option>
                {FORM_SUBJECT_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>

            <textarea
              aria-label={FORM_FIELD_LABELS.message}
              className="min-h-40 min-w-0 rounded-xl border border-white/10 bg-black/20 px-5 py-4 text-white outline-none transition placeholder:text-white/40 focus:border-[#d2a75a]/60"
              placeholder={FORM_FIELD_LABELS.message}
            />

            <label className="flex items-center gap-3 text-sm text-white/55">
              <input type="checkbox" className="h-4 w-4 accent-[#d2a75a]" />
              {FORM_FIELD_LABELS.privacy}
            </label>

            {form.submitLabel.trim() ? (
              <button
                type="button"
                className="rounded-xl bg-gradient-to-l from-[#e7b66a] to-[#b98236] px-6 py-4 font-semibold text-black transition hover:brightness-110"
              >
                {form.submitLabel}
              </button>
            ) : null}
          </form>
        </div>
      ) : null}
    </section>
  );
}
