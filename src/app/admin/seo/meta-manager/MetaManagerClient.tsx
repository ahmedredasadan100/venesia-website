"use client";

import AdminMediaImageField from "../../../../components/admin/media/AdminMediaImageField";
import AdminFormRuntime, {
  AdminFormActions,
  AdminFormError,
  AdminFormGrid,
  useAdminFormRuntime,
} from "../../../../components/admin/ui/AdminFormRuntime";
import AdminModuleTabs, { AdminModuleSectionHeader, AdminModuleTabIcon } from "../../../../components/admin/ui/AdminModuleTabs";
import {
  ADMIN_FORM_STACK_CLASS_NAME,
  AdminCard,
  AdminFormControlHeader,
  AdminFormField,
  AdminFormListboxSelect,
  AdminFormSection,
  adminFormFieldClassName,
} from "../../../../components/admin/ui";
import { ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME, adminFormHintClassName, adminFormLabelClassName } from "../../../../lib/admin/admin-ui-styles";
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

const META_MANAGER_NAVIGATION_EVENT = "admin:global-seo-field-navigation";

function fieldSupportIds(field: GlobalSeoFieldKey, hasError: boolean) {
  return `${field}-source-note${hasError ? ` ${field}-error` : ""}`;
}

function SourceNote({
  contract,
  field,
}: {
  contract: GlobalSeoEffectiveContract;
  field: GlobalSeoFieldKey;
}) {
  const source = contract.fields[field];
  return (
    <span
      id={`${field}-source-note`}
      className={adminFormHintClassName({ textInset: true })}
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
    </span>
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
  const { fieldErrors } = useAdminFormRuntime();
  const hasError = Boolean(fieldErrors[field]?.length);
  const persisted = contract.persistedSettings[field];
  const effective = contract.settings[field];
  const shared = {
    id: field,
    name,
    defaultValue: typeof persisted === "string" ? persisted : "",
    placeholder: typeof effective === "string" ? effective : "",
    className: adminFormFieldClassName(hasError ? "border-red-400/40" : ""),
    "aria-invalid": hasError,
    "aria-describedby": fieldSupportIds(field, hasError),
    dir,
  } as const;
  return (
    <AdminFormField label={label} presentation="panel">
      <AdminFormGrid columns={1} density="compact">
      {multiline ? <textarea {...shared} rows={4} /> : <input {...shared} />}
      <SourceNote contract={contract} field={field} />
      <AdminFormError name={field} />
      </AdminFormGrid>
    </AdminFormField>
  );
}

function ImageSourceField({
  contract,
  field,
  name,
  label,
  dir,
}: {
  contract: GlobalSeoEffectiveContract;
  field: "defaultOgImage" | "defaultTwitterImage" | "organizationLogo";
  name: string;
  label: string;
  dir?: "ltr" | "rtl";
}) {
  const { fieldErrors } = useAdminFormRuntime();
  const hasError = Boolean(fieldErrors[field]?.length);
  const persisted = contract.persistedSettings[field];
  const effective = contract.settings[field];
  return (
    <AdminFormGrid columns={1} density="compact">
      <AdminMediaImageField
        name={name}
        label={label}
        labelClassName={adminFormLabelClassName({ textInset: true })}
        defaultValue={typeof persisted === "string" ? persisted : ""}
        variant="card"
        urlInput={{
          id: field,
          placeholder: typeof effective === "string" ? effective : "",
          dir,
          ariaInvalid: hasError,
          ariaDescribedBy: fieldSupportIds(field, hasError),
        }}
        ariaDescribedBy={fieldSupportIds(field, hasError)}
      />
      <SourceNote contract={contract} field={field} />
      <AdminFormError name={field} />
    </AdminFormGrid>
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
  const { fieldErrors } = useAdminFormRuntime();
  const persisted = contract.persistedSettings[field];
  return (
    <AdminFormGrid columns={1} density="compact">
      <AdminFormListboxSelect
        id={field}
        focusTargetId={field}
        ariaDescribedBy={`${field}-source-note`}
        label={label}
        presentation="panel"
        error={fieldErrors[field]?.join(" ") ?? null}
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
    </AdminFormGrid>
  );
}

function DefaultsTab({ contract }: MetaManagerClientProps) {
  return (
    <div className={ADMIN_FORM_STACK_CLASS_NAME}>
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
        <ImageSourceField
          contract={contract}
          field="defaultOgImage"
          name="default_og_image"
          label="صورة Open Graph"
          dir="ltr"
        />
        <ImageSourceField
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
    </div>
  );
}

function IdentityTab({ contract }: MetaManagerClientProps) {
  const { fieldErrors } = useAdminFormRuntime();
  const persistedLinks =
    contract.persistedSettings.organizationSocialLinks ?? [];
  const persistedKnowsAbout =
    contract.persistedSettings.organizationKnowsAbout ?? [];
  return (
    <div className={ADMIN_FORM_STACK_CLASS_NAME}>
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
        <ImageSourceField
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
      <AdminFormField label="مجالات المعرفة — قيمة في كل سطر" presentation="panel">
        <AdminFormGrid columns={1} density="compact">
        <textarea
          id="organizationKnowsAbout"
          name="organization_knows_about"
          rows={5}
          defaultValue={persistedKnowsAbout.join("\n")}
          placeholder={contract.settings.organizationKnowsAbout.join("\n")}
          className={adminFormFieldClassName(fieldErrors.organizationKnowsAbout?.length ? "border-red-400/40" : "")}
          aria-invalid={Boolean(fieldErrors.organizationKnowsAbout?.length)}
          aria-describedby={fieldSupportIds("organizationKnowsAbout", Boolean(fieldErrors.organizationKnowsAbout?.length))}
        />
        <SourceNote contract={contract} field="organizationKnowsAbout" />
        <AdminFormError name="organizationKnowsAbout" />
        </AdminFormGrid>
      </AdminFormField>
      <div className={ADMIN_FORM_STACK_CLASS_NAME} role="group" aria-labelledby="organization-social-links-heading" aria-describedby={fieldSupportIds("organizationSocialLinks", Boolean(fieldErrors.organizationSocialLinks?.length))}>
        <AdminFormControlHeader title={<span id="organization-social-links-heading">روابط المؤسسة</span>} presentation="compact-inline" />
        {(persistedLinks.length
          ? persistedLinks
          : [{ label: "", href: "" }]
        ).map((link: GlobalSeoSocialLink, index: number) => (
          <AdminFormGrid key={`${link.label}-${index}`}>
            <AdminFormField label="المنصة" presentation="panel">
              <input
                id={index === 0 ? "organizationSocialLinks" : undefined}
                name="social_label"
                defaultValue={link.label}
                className={adminFormFieldClassName()}
                aria-invalid={Boolean(fieldErrors.organizationSocialLinks?.length)}
                aria-describedby={fieldSupportIds("organizationSocialLinks", Boolean(fieldErrors.organizationSocialLinks?.length))}
              />
            </AdminFormField>
            <AdminFormField label="الرابط" presentation="panel">
              <input
                name="social_href"
                defaultValue={link.href}
                className={adminFormFieldClassName()}
                dir="ltr"
                aria-invalid={Boolean(fieldErrors.organizationSocialLinks?.length)}
                aria-describedby={fieldSupportIds("organizationSocialLinks", Boolean(fieldErrors.organizationSocialLinks?.length))}
              />
            </AdminFormField>
          </AdminFormGrid>
        ))}
        <SourceNote contract={contract} field="organizationSocialLinks" />
        <AdminFormError name="organizationSocialLinks" />
      </div>
    </div>
  );
}

function CrawlTab({ contract }: MetaManagerClientProps) {
  const { fieldErrors } = useAdminFormRuntime();
  return (
    <div className={ADMIN_FORM_STACK_CLASS_NAME}>
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
        <AdminFormField label="Robots Allow — مسار في كل سطر" presentation="panel">
          <AdminFormGrid columns={1} density="compact">
          <textarea
            id="robotsTxtAllow"
            name="robots_txt_allow"
            rows={7}
            defaultValue={(
              contract.persistedSettings.robotsTxtAllow ?? []
            ).join("\n")}
            placeholder={contract.settings.robotsTxtAllow.join("\n")}
            className={adminFormFieldClassName(fieldErrors.robotsTxtAllow?.length ? "border-red-400/40" : "")}
            dir="ltr"
            aria-invalid={Boolean(fieldErrors.robotsTxtAllow?.length)}
            aria-describedby={fieldSupportIds("robotsTxtAllow", Boolean(fieldErrors.robotsTxtAllow?.length))}
          />
          <SourceNote contract={contract} field="robotsTxtAllow" />
          <AdminFormError name="robotsTxtAllow" />
          </AdminFormGrid>
        </AdminFormField>
        <AdminFormField label="Robots Disallow — مسار في كل سطر" presentation="panel">
          <AdminFormGrid columns={1} density="compact">
          <textarea
            id="robotsTxtDisallow"
            name="robots_txt_disallow"
            rows={7}
            defaultValue={(
              contract.persistedSettings.robotsTxtDisallow ?? []
            ).join("\n")}
            placeholder={contract.settings.robotsTxtDisallow.join("\n")}
            className={adminFormFieldClassName(fieldErrors.robotsTxtDisallow?.length ? "border-red-400/40" : "")}
            dir="ltr"
            aria-invalid={Boolean(fieldErrors.robotsTxtDisallow?.length)}
            aria-describedby={fieldSupportIds("robotsTxtDisallow", Boolean(fieldErrors.robotsTxtDisallow?.length))}
          />
          <SourceNote contract={contract} field="robotsTxtDisallow" />
          <AdminFormError name="robotsTxtDisallow" />
          </AdminFormGrid>
        </AdminFormField>
      </AdminFormGrid>
    </div>
  );
}

function PreviewTab({ contract }: MetaManagerClientProps) {
  const settings = contract.settings;
  return (
    <div className={ADMIN_FORM_STACK_CLASS_NAME}>
      <AdminCard presentation="premium" className="p-3">
      <div dir="rtl">
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
      </AdminCard>
      <AdminFormGrid>
        <AdminCard presentation="premium" className="p-3">
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
        </AdminCard>
        <AdminCard presentation="premium" className="p-3">
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
        </AdminCard>
      </AdminFormGrid>
      <p className="text-sm leading-7 text-white/45">
        هذه معاينة للـEffective Contract الحالي. التعديلات غير المحفوظة لا تصبح
        Effective قبل نجاح الحفظ.
      </p>
    </div>
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
      fields: ["siteName", "defaultTitle", "defaultDescription", "defaultOgImage", "defaultTwitterImage", "defaultOgImageAlt", "twitterHandle", "defaultRobotsIndex", "defaultRobotsFollow"] as const,
      content: <DefaultsTab contract={contract} />,
    },
    {
      id: "identity",
      navigationLabel: "Identity",
      sectionHeading: "Organization Identity",
      sectionDescription:
        "الهوية المنظمة الوحيدة التي يستهلكها Metadata وStructured Data والأسطح العامة.",
      icon: "content" as const,
      fields: ["organizationName", "organizationAlternateName", "organizationLegalName", "organizationTagline", "organizationDescription", "organizationLogo", "organizationAreaServed", "organizationPhone", "organizationEmail", "organizationAddress", "organizationAddressLocality", "organizationAddressRegion", "organizationPostalCode", "organizationAddressCountry", "organizationKnowsAbout", "organizationSocialLinks"] as const,
      content: <IdentityTab contract={contract} />,
    },
    {
      id: "crawl",
      navigationLabel: "Crawl",
      sectionHeading: "Canonical and Crawl Policy",
      sectionDescription:
        "قاعدة الدومين وRobots policy ومفاتيح التحقق دون تعديل Canonical الكيانات.",
      icon: "section" as const,
      fields: ["siteUrl", "canonicalBaseUrl", "googleSiteVerification", "bingSiteVerification", "robotsTxtAllow", "robotsTxtDisallow"] as const,
      content: <CrawlTab contract={contract} />,
    },
    {
      id: "preview",
      navigationLabel: "Preview",
      sectionHeading: "Effective Preview",
      sectionDescription:
        "معاينة القيم الفعلية بعد تطبيق Database ثم Environment ثم Code Fallback.",
      icon: "overview" as const,
      fields: [] as const,
      content: <PreviewTab contract={contract} />,
    },
  ];
  const navigation = {
    eventName: META_MANAGER_NAVIGATION_EVENT,
    fields: Object.fromEntries(tabs.flatMap(tab => tab.fields.map(field => [field, { tabId: tab.id, targetId: field }]))),
  };
  return (
    <AdminFormRuntime<GlobalSeoSettingsInput>
      action={saveGlobalSeoSettingsAction}
      initialState={initialState}
      mode="edit"
      entityKey="global-seo-settings"
      closeHref="/admin"
      className="pb-10"
      navigation={navigation}
    >
      <div className={ADMIN_FORM_STACK_CLASS_NAME}>
      <AdminModuleTabs
        tabs={tabs.map(tab => ({
          ...tab,
          sectionHeading: undefined,
          sectionDescription: undefined,
          content: <AdminFormSection presentation="panel" header={<AdminModuleSectionHeader id={`global-seo-${tab.id}`} sectionHeading={tab.sectionHeading} sectionDescription={tab.sectionDescription} icon={tab.icon} sectionHeaderPresentation="premium" sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME} />}>{tab.content}</AdminFormSection>,
        }))}
        initialTabId="defaults"
        ariaLabel="أقسام Global SEO"
        navigationEventName={META_MANAGER_NAVIGATION_EVENT}
      />
      <AdminFormActions
        submitLabel="حفظ Global SEO"
        pendingLabel="جارٍ الحفظ…"
        title="إجراءات النموذج"
        icon={<AdminModuleTabIcon name="content" />}
        description="احفظ القيم المدخلة فقط؛ الحقول الفارغة تستمر في الوراثة ولا تُعرض كقيم persisted."
      />
      </div>
    </AdminFormRuntime>
  );
}
