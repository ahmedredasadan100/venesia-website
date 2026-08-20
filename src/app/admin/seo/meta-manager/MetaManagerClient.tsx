"use client";

import type { ReactNode } from "react";

import AdminFormRuntime, {
  AdminFormActions,
  AdminFormError,
  AdminFormGrid,
} from "../../../../components/admin/ui/AdminFormRuntime";
import AdminModuleTabs from "../../../../components/admin/ui/AdminModuleTabs";
import {
  AdminFormField,
  AdminFormListboxSelect,
  adminFormFieldClassName,
} from "../../../../components/admin/ui";
import type {
  GlobalSeoEffectiveContract,
  GlobalSeoFieldKey,
  GlobalSeoSettingsInput,
  GlobalSeoSocialLink,
} from "../../../../lib/seo/global-seo-types";
import {
  saveGlobalSeoSettingsAction,
  type GlobalSeoFormActionState,
} from "./actions";

type MetaManagerClientProps = { contract: GlobalSeoEffectiveContract };

const sourceLabels = {
  database: "Database",
  environment: "Environment",
  code_fallback: "Code Fallback",
} as const;

function SourceNote({
  contract,
  field,
}: {
  contract: GlobalSeoEffectiveContract;
  field: GlobalSeoFieldKey;
}) {
  const source = contract.fields[field];
  return (
    <p
      className="mt-1 text-xs text-white/42"
      data-seo-effective-source={source.source}
    >
      المصدر الفعلي:{" "}
      <span className="font-en text-white/65">
        {sourceLabels[source.source]}
      </span>
      {source.source === "environment" ? ` · ${source.environmentKey}` : ""}
      {!source.persisted
        ? " · الحقل الفارغ يرث هذه القيمة ولا يحفظها ضمنيًا"
        : ""}
    </p>
  );
}

function SectionCard({ children }: { children: ReactNode }) {
  return (
    <section className="space-y-5 rounded-[24px] border border-white/10 bg-[#080B10]/78 p-5">
      {children}
    </section>
  );
}

function StringField({
  contract,
  field,
  name,
  label,
  multiline = false,
  dir,
}: {
  contract: GlobalSeoEffectiveContract;
  field: GlobalSeoFieldKey;
  name: string;
  label: string;
  multiline?: boolean;
  dir?: "ltr" | "rtl";
}) {
  const persisted = contract.persistedSettings[field];
  const effective = contract.settings[field];
  const shared = {
    id: field,
    name,
    defaultValue: typeof persisted === "string" ? persisted : "",
    placeholder: typeof effective === "string" ? effective : "",
    className: adminFormFieldClassName(),
    dir,
  } as const;
  return (
    <AdminFormField label={label}>
      {multiline ? <textarea {...shared} rows={4} /> : <input {...shared} />}
      <SourceNote contract={contract} field={field} />
      <AdminFormError name={field} />
    </AdminFormField>
  );
}

function BooleanSourceField({
  contract,
  field,
  name,
  label,
}: {
  contract: GlobalSeoEffectiveContract;
  field: "defaultRobotsIndex" | "defaultRobotsFollow";
  name: string;
  label: string;
}) {
  const persisted = contract.persistedSettings[field];
  return (
    <AdminFormField label={label}>
      <AdminFormListboxSelect
        id={field}
        name={name}
        defaultValue={
          typeof persisted === "boolean" ? String(persisted) : "inherit"
        }
        options={[
          { value: "inherit", label: "وراثة Effective Source" },
          { value: "true", label: "نعم" },
          { value: "false", label: "لا" },
        ]}
      />
      <SourceNote contract={contract} field={field} />
      <AdminFormError name={field} />
    </AdminFormField>
  );
}

function DefaultsTab({ contract }: MetaManagerClientProps) {
  return (
    <SectionCard>
      <AdminFormGrid>
        <StringField
          contract={contract}
          field="siteName"
          name="site_name"
          label="اسم الموقع"
        />
        <StringField
          contract={contract}
          field="defaultTitle"
          name="default_title"
          label="العنوان الافتراضي"
        />
      </AdminFormGrid>
      <StringField
        contract={contract}
        field="defaultDescription"
        name="default_description"
        label="الوصف الافتراضي"
        multiline
      />
      <AdminFormGrid>
        <StringField
          contract={contract}
          field="defaultOgImage"
          name="default_og_image"
          label="صورة Open Graph"
          dir="ltr"
        />
        <StringField
          contract={contract}
          field="defaultTwitterImage"
          name="default_twitter_image"
          label="صورة Twitter/X"
          dir="ltr"
        />
        <StringField
          contract={contract}
          field="defaultOgImageAlt"
          name="default_og_image_alt"
          label="النص البديل الافتراضي"
        />
        <StringField
          contract={contract}
          field="twitterHandle"
          name="twitter_handle"
          label="Twitter/X Handle"
          dir="ltr"
        />
        <BooleanSourceField
          contract={contract}
          field="defaultRobotsIndex"
          name="default_robots_index"
          label="Index الافتراضي"
        />
        <BooleanSourceField
          contract={contract}
          field="defaultRobotsFollow"
          name="default_robots_follow"
          label="Follow الافتراضي"
        />
      </AdminFormGrid>
    </SectionCard>
  );
}

function IdentityTab({ contract }: MetaManagerClientProps) {
  const persistedLinks =
    contract.persistedSettings.organizationSocialLinks ?? [];
  const persistedKnowsAbout =
    contract.persistedSettings.organizationKnowsAbout ?? [];
  return (
    <SectionCard>
      <AdminFormGrid>
        <StringField
          contract={contract}
          field="organizationName"
          name="organization_name"
          label="اسم المؤسسة"
        />
        <StringField
          contract={contract}
          field="organizationAlternateName"
          name="organization_alternate_name"
          label="الاسم البديل"
        />
        <StringField
          contract={contract}
          field="organizationLegalName"
          name="organization_legal_name"
          label="الاسم القانوني"
        />
        <StringField
          contract={contract}
          field="organizationTagline"
          name="organization_tagline"
          label="الشعار النصي"
        />
      </AdminFormGrid>
      <StringField
        contract={contract}
        field="organizationDescription"
        name="organization_description"
        label="وصف المؤسسة"
        multiline
      />
      <AdminFormGrid>
        <StringField
          contract={contract}
          field="organizationLogo"
          name="organization_logo"
          label="شعار المؤسسة"
          dir="ltr"
        />
        <StringField
          contract={contract}
          field="organizationAreaServed"
          name="organization_area_served"
          label="النطاق الجغرافي"
        />
        <StringField
          contract={contract}
          field="organizationPhone"
          name="organization_phone"
          label="الهاتف الأساسي"
          dir="ltr"
        />
        <StringField
          contract={contract}
          field="organizationEmail"
          name="organization_email"
          label="البريد الأساسي"
          dir="ltr"
        />
        <StringField
          contract={contract}
          field="organizationAddress"
          name="organization_address"
          label="العنوان"
        />
        <StringField
          contract={contract}
          field="organizationAddressLocality"
          name="organization_address_locality"
          label="المدينة"
        />
        <StringField
          contract={contract}
          field="organizationAddressRegion"
          name="organization_address_region"
          label="المحافظة/المنطقة"
        />
        <StringField
          contract={contract}
          field="organizationPostalCode"
          name="organization_postal_code"
          label="الرمز البريدي"
          dir="ltr"
        />
        <StringField
          contract={contract}
          field="organizationAddressCountry"
          name="organization_address_country"
          label="رمز الدولة"
          dir="ltr"
        />
      </AdminFormGrid>
      <AdminFormField label="مجالات المعرفة — قيمة في كل سطر">
        <textarea
          id="organizationKnowsAbout"
          name="organization_knows_about"
          rows={5}
          defaultValue={persistedKnowsAbout.join("\n")}
          placeholder={contract.settings.organizationKnowsAbout.join("\n")}
          className={adminFormFieldClassName()}
        />
        <SourceNote contract={contract} field="organizationKnowsAbout" />
        <AdminFormError name="organizationKnowsAbout" />
      </AdminFormField>
      <div className="space-y-3">
        <p className="text-sm font-semibold text-white/75">روابط المؤسسة</p>
        {(persistedLinks.length
          ? persistedLinks
          : [{ label: "", href: "" }]
        ).map((link: GlobalSeoSocialLink, index: number) => (
          <AdminFormGrid key={`${link.label}-${index}`}>
            <AdminFormField label="المنصة">
              <input
                name="social_label"
                defaultValue={link.label}
                className={adminFormFieldClassName()}
              />
            </AdminFormField>
            <AdminFormField label="الرابط">
              <input
                name="social_href"
                defaultValue={link.href}
                className={adminFormFieldClassName()}
                dir="ltr"
              />
            </AdminFormField>
          </AdminFormGrid>
        ))}
        <SourceNote contract={contract} field="organizationSocialLinks" />
        <AdminFormError name="organizationSocialLinks" />
      </div>
    </SectionCard>
  );
}

function CrawlTab({ contract }: MetaManagerClientProps) {
  return (
    <SectionCard>
      <AdminFormGrid>
        <StringField
          contract={contract}
          field="siteUrl"
          name="site_url"
          label="Site URL"
          dir="ltr"
        />
        <StringField
          contract={contract}
          field="canonicalBaseUrl"
          name="canonical_base_url"
          label="Canonical Base URL"
          dir="ltr"
        />
        <StringField
          contract={contract}
          field="googleSiteVerification"
          name="google_site_verification"
          label="Google Verification"
          dir="ltr"
        />
        <StringField
          contract={contract}
          field="bingSiteVerification"
          name="bing_site_verification"
          label="Bing Verification"
          dir="ltr"
        />
      </AdminFormGrid>
      <AdminFormGrid>
        <AdminFormField label="Robots Allow — مسار في كل سطر">
          <textarea
            id="robotsTxtAllow"
            name="robots_txt_allow"
            rows={7}
            defaultValue={(
              contract.persistedSettings.robotsTxtAllow ?? []
            ).join("\n")}
            placeholder={contract.settings.robotsTxtAllow.join("\n")}
            className={adminFormFieldClassName()}
            dir="ltr"
          />
          <SourceNote contract={contract} field="robotsTxtAllow" />
          <AdminFormError name="robotsTxtAllow" />
        </AdminFormField>
        <AdminFormField label="Robots Disallow — مسار في كل سطر">
          <textarea
            id="robotsTxtDisallow"
            name="robots_txt_disallow"
            rows={7}
            defaultValue={(
              contract.persistedSettings.robotsTxtDisallow ?? []
            ).join("\n")}
            placeholder={contract.settings.robotsTxtDisallow.join("\n")}
            className={adminFormFieldClassName()}
            dir="ltr"
          />
          <SourceNote contract={contract} field="robotsTxtDisallow" />
          <AdminFormError name="robotsTxtDisallow" />
        </AdminFormField>
      </AdminFormGrid>
    </SectionCard>
  );
}

function PreviewTab({ contract }: MetaManagerClientProps) {
  const settings = contract.settings;
  return (
    <SectionCard>
      <div
        className="rounded-2xl border border-white/10 bg-black/25 p-5"
        dir="rtl"
      >
        <p className="font-en text-sm text-emerald-300">
          {settings.canonicalBaseUrl}
        </p>
        <h3 className="mt-2 text-xl font-semibold text-[#8AB4F8]">
          {settings.defaultTitle}
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-white/62">
          {settings.defaultDescription}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/42">
            Open Graph
          </p>
          <p className="mt-3 font-semibold text-white">
            {settings.defaultTitle}
          </p>
          <p className="mt-2 text-sm text-white/55">
            {settings.defaultDescription}
          </p>
          <p className="mt-3 font-en text-xs text-white/40">
            {settings.defaultOgImage}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/42">
            Organization
          </p>
          <p className="mt-3 font-semibold text-white">
            {settings.organizationName}
          </p>
          <p className="mt-2 text-sm text-white/55">
            {settings.organizationDescription}
          </p>
          <p className="mt-3 font-en text-xs text-white/40">
            {settings.organizationPhone} · {settings.organizationEmail}
          </p>
        </div>
      </div>
      <p className="text-sm leading-7 text-white/45">
        هذه معاينة للـEffective Contract الحالي. التعديلات غير المحفوظة لا تصبح
        Effective قبل نجاح الحفظ.
      </p>
    </SectionCard>
  );
}

export default function MetaManagerClient({
  contract,
}: MetaManagerClientProps) {
  const initialState: GlobalSeoFormActionState = {
    status: "idle",
    mode: "edit",
    revision: 0,
  };
  const tabs = [
    {
      id: "defaults",
      navigationLabel: "Defaults",
      sectionHeading: "Global SEO Defaults",
      sectionDescription:
        "قيم metadata والمشاركة والـrobots الافتراضية مع مصدر كل قيمة.",
      icon: "seo" as const,
      content: <DefaultsTab contract={contract} />,
    },
    {
      id: "identity",
      navigationLabel: "Identity",
      sectionHeading: "Organization Identity",
      sectionDescription:
        "الهوية المنظمة الوحيدة التي يستهلكها Metadata وStructured Data والأسطح العامة.",
      icon: "content" as const,
      content: <IdentityTab contract={contract} />,
    },
    {
      id: "crawl",
      navigationLabel: "Crawl",
      sectionHeading: "Canonical and Crawl Policy",
      sectionDescription:
        "قاعدة الدومين وRobots policy ومفاتيح التحقق دون تعديل Canonical الكيانات.",
      icon: "section" as const,
      content: <CrawlTab contract={contract} />,
    },
    {
      id: "preview",
      navigationLabel: "Preview",
      sectionHeading: "Effective Preview",
      sectionDescription:
        "معاينة القيم الفعلية بعد تطبيق Database ثم Environment ثم Code Fallback.",
      icon: "overview" as const,
      content: <PreviewTab contract={contract} />,
    },
  ];
  return (
    <AdminFormRuntime<GlobalSeoSettingsInput>
      action={saveGlobalSeoSettingsAction}
      initialState={initialState}
      mode="edit"
      entityKey="global-seo-settings"
      closeHref="/admin"
      className="space-y-6 pb-10"
    >
      <AdminModuleTabs
        tabs={tabs}
        initialTabId="defaults"
        ariaLabel="أقسام Global SEO"
      />
      <AdminFormActions
        submitLabel="حفظ Global SEO"
        pendingLabel="جارٍ الحفظ…"
        title="إجراءات Global SEO"
        description="احفظ القيم المدخلة فقط؛ الحقول الفارغة تستمر في الوراثة ولا تُعرض كقيم persisted."
      />
    </AdminFormRuntime>
  );
}
