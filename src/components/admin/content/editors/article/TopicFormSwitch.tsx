import AdminFormSwitch, {
  ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME,
} from "../../../ui/AdminFormSwitch";

export const TOPIC_SETTINGS_SURFACE_CLASS_NAME =
  ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME;

type TopicFormSwitchProps = {
  id?: string;
  name: string;
  label: string;
  defaultChecked: boolean;
  surface?: boolean;
  disabled?: boolean;
  className?: string;
};

export default function TopicFormSwitch({
  id,
  name,
  label,
  defaultChecked,
  surface = false,
  disabled = false,
  className,
}: TopicFormSwitchProps) {
  return (
    <AdminFormSwitch
      id={id}
      name={name}
      label={label}
      defaultChecked={defaultChecked}
      surface={surface}
      disabled={disabled}
      className={className}
    />
  );
}
