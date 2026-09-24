/** Labelled on/off switch for settings forms; submits "on" when checked. */
export function SettingToggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block font-medium text-slate-50 light:text-slate-900">{label}</span>
        <span className="mt-0.5 block text-sm text-slate-400 light:text-slate-500">{description}</span>
      </span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-white/10 transition-colors has-[:checked]:bg-emerald-500/80 light:bg-slate-200">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-slate-300 transition-transform peer-checked:translate-x-5 peer-checked:bg-white" />
      </span>
    </label>
  );
}
