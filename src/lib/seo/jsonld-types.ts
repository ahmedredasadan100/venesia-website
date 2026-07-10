export type JsonLdPrimitive = string | number | boolean | null | undefined;
export type JsonLdObject = { [key: string]: JsonLdValue };
export type JsonLdValue = JsonLdPrimitive | JsonLdObject | JsonLdValue[];
