import AdminFormSwitch, {
  ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME,
  type AdminFormSwitchProps,
} from "../../../ui/AdminFormSwitch";

export const TOPIC_SETTINGS_SURFACE_CLASS_NAME =
  ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME;

type TopicFormSwitchProps = {
  id?: string;
  name: string;
  label: string;
  icon?: AdminFormSwitchProps["icon"];
  defaultChecked: boolean;
  surface?: boolean;
  presentation?: AdminFormSwitchProps["presentation"];
  embedded?: boolean;
  embeddedLayout?: AdminFormSwitchProps["embeddedLayout"];
  disabled?: boolean;
  className?: string;
};

export default function TopicFormSwitch({
  id,
  name,
  label,
  icon,
  defaultChecked,
  surface = false,
  presentation,
  embedded = false,
  embeddedLayout,
  disabled = false,
  className,
}: TopicFormSwitchProps) {
  return (
    <AdminFormSwitch
      id={id}
      name={name}
      label={label}
      icon={icon}
      defaultChecked={defaultChecked}
      surface={surface}
      presentation={presentation}
      embedded={embedded}
      embeddedLayout={embeddedLayout}
      disabled={disabled}
      className={className}
    />
  );
}
