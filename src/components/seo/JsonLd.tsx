type JsonLdPrimitive = string | number | boolean | null | undefined;
type JsonLdObject = { readonly [key: string]: JsonLdValue };
type JsonLdValue = JsonLdPrimitive | JsonLdObject | readonly JsonLdValue[];

type JsonLdProps = {
  data: JsonLdValue | JsonLdValue[];
};

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data),
      }}
    />
  );
}
