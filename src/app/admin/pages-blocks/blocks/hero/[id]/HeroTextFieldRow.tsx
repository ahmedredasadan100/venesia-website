import { fieldClassName } from "../../../../../../lib/page-blocks/admin-utils";
import type { HeroTextAlignment } from "../../../../../../lib/hero/hero-content-controls";
import HeroVisibilityAlignRow from "./HeroVisibilityAlignRow";

type HeroTextFieldRowProps = {
  label: string;
  name: string;
  defaultValue?: string;
  boldName: string;
  alignmentName: string;
  showName: string;
  boldDefault?: boolean;
  alignmentDefault?: HeroTextAlignment;
  showDefault?: boolean;
  enableAlignment?: boolean;
  enableBold?: boolean;
  placeholder?: string;
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
}: HeroTextFieldRowProps) {
  return (
    <HeroVisibilityAlignRow
      label={label}
      alignmentName={alignmentName}
      showName={showName}
      boldName={boldName}
      alignmentDefault={alignmentDefault}
      showDefault={showDefault}
      enableAlignment={enableAlignment}
      enableBold={enableBold}
      boldDefault={boldDefault}
    >
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={fieldClassName("h-11 min-w-0")}
      />
    </HeroVisibilityAlignRow>
  );
}
