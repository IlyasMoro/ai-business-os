import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input, Label, Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { SettingToggle } from "@/components/ui-dark/setting-toggle";
import { getEdiSettings } from "@/lib/edi/settings";
import { updateEdiSettings } from "@/lib/actions/edi";

export default async function EdiSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { error, saved } = await searchParams;
  const s = await getEdiSettings(session.companyId);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">EDI settings</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        Your identity on the EDI network and the file format your partners expect.
      </p>

      <div className="mt-4 max-w-2xl space-y-3">
        <ErrorBanner code={error} />
        {saved && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">Saved.</div>
        )}
      </div>

      <form
        action={updateEdiSettings}
        className="mt-6 max-w-2xl space-y-5 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5"
      >
        <SettingToggle
          name="enabled"
          label="Use EDI"
          description="Turn this off if you don't trade by EDI. The EDI page is hidden while it's off."
          defaultChecked={s?.enabled ?? true}
        />

        <div>
          <p className="font-medium text-slate-50 light:text-slate-900">Your identity</p>
          <p className="text-sm text-slate-400 light:text-slate-500">Your partners address files to these IDs.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="isaQualifier">ISA qualifier</Label>
              <Input id="isaQualifier" name="isaQualifier" defaultValue={s?.isaQualifier ?? "ZZ"} maxLength={2} required />
              <p className="mt-1 text-xs text-slate-500">ZZ is mutually defined; 01 is a DUNS number.</p>
            </div>
            <div>
              <Label htmlFor="isaId">ISA ID</Label>
              <Input id="isaId" name="isaId" defaultValue={s?.isaId ?? ""} maxLength={15} required />
            </div>
            <div>
              <Label htmlFor="gsId">GS ID</Label>
              <Input id="gsId" name="gsId" defaultValue={s?.gsId ?? ""} maxLength={15} required />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="version">X12 version</Label>
            <Select id="version" name="version" defaultValue={s?.version ?? "004010"}>
              <option value="004010">4010</option>
              <option value="005010">5010</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="usageIndicator">Mode</Label>
            <Select id="usageIndicator" name="usageIndicator" defaultValue={s?.usageIndicator ?? "T"}>
              <option value="T">Test</option>
              <option value="P">Production</option>
            </Select>
            <p className="mt-1 text-xs text-slate-500">Stay in test until each partner has certified your files.</p>
          </div>
        </div>

        <div>
          <p className="font-medium text-slate-50 light:text-slate-900">Separators</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="elementSeparator">Element</Label>
              <Input id="elementSeparator" name="elementSeparator" defaultValue={s?.elementSeparator ?? "*"} maxLength={1} required className="font-mono" />
            </div>
            <div>
              <Label htmlFor="subElementSeparator">Sub element</Label>
              <Input id="subElementSeparator" name="subElementSeparator" defaultValue={s?.subElementSeparator ?? ">"} maxLength={1} required className="font-mono" />
            </div>
            <div>
              <Label htmlFor="segmentTerminator">Segment end</Label>
              <Input id="segmentTerminator" name="segmentTerminator" defaultValue={s?.segmentTerminator ?? "~"} maxLength={1} required className="font-mono" />
            </div>
          </div>
        </div>

        {s && (
          <p className="text-xs text-slate-500">
            Next interchange control number: <span className="font-mono">{String(s.nextControlNumber).padStart(9, "0")}</span>
          </p>
        )}

        <SubmitButton pendingText="Saving...">Save settings</SubmitButton>
      </form>

      <p className="mt-6">
        <Link href="/dashboard/edi" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
          ← Back to EDI
        </Link>
      </p>
    </div>
  );
}
