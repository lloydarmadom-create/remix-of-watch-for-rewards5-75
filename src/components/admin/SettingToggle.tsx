import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function SettingToggle({
  label,
  hint,
  checked,
  onChange,
  warn,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  warn?: boolean;
}) {
  return (
    <label className="vault-well flex cursor-pointer items-center gap-3 p-3">
      <div className="flex-1">
        <p className={cn("text-sm font-semibold", warn && checked && "text-gold")}>{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-emerald" />
    </label>
  );
}
