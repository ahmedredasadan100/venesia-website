"use client";

import { useState } from "react";
import { fieldClassName } from "../../../../../../lib/page-blocks/admin-utils";
import type { HeroDescriptionAlignment } from "../../../../../../lib/hero/hero-content-controls";
import { stripHtml } from "../../../../../../lib/rich-text/html-utils";
import HeroVisibilityAlignRow from "./HeroVisibilityAlignRow";
import { AdminModuleTabIcon } from "../../../../../../components/admin/ui/AdminModuleTabs";

type HeroTextFieldRowProps = {
  label: string;
  name: string;
  defaultValue?: string;
  boldName: string;
  alignmentName: string;
  showName: string;
  boldDefault?: boolean;
  alignmentDefault?: HeroDescriptionAlignment;
  showDefault?: boolean;
  enableAlignment?: boolean;
  enableBold?: boolean;
  placeholder?: string;
  preserveRichText?: boolean;
};

export default function HeroTextFieldRow({
  label,
  name,
  defaultValue = "",
  boldName,
  alignmentName,
  showName,
  boldDefault = false,
  alignmentDefault = "right",
  showDefault = true,
  enableAlignment = true,
  enableBold = true,
  placeholder,
  preserveRichText = false,
}: HeroTextFieldRowProps) {
  const initialText = preserveRichText
    ? stripHtml(defaultValue).replace(/\s+/gu, " ")
    : defaultValue;
  const [text, setText] = useState(initialText);

  return (
    <HeroVisibilityAlignRow
      label={label}
      icon={<AdminModuleTabIcon name="content" />}
      alignmentName={alignmentName}
      showName={showName}
      boldName={boldName}
      alignmentDefault={alignmentDefault}
      showDefault={showDefault}
      enableAlignment={enableAlignment}
      enableBold={enableBold}
      boldDefault={boldDefault}
    >
      {preserveRichText ? (
        <input
          type="hidden"
          name={name}
          value={text === initialText ? defaultValue : text}
        />
      ) : null}
      <input
        name={preserveRichText ? `${name}_editor` : name}
        aria-label={label}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        className={fieldClassName("h-11 min-w-0")}
      />
    </HeroVisibilityAlignRow>
  );
}
