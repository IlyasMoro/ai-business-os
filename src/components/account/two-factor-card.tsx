"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import {
  cancelTwoFactorSetup,
  confirmTwoFactor,
  disableTwoFactor,
  regenerateRecoveryCodes,
  startTwoFactorSetup,
  type TwoFactorFormState,
} from "@/lib/actions/two-factor";
import { Button, buttonStyles } from "@/components/ui-dark/button";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { Input, Label } from "@/components/ui-dark/input";
import { formatDate } from "@/lib/utils";

type Props = {
  enabledAt: string | null;
  recoveryCodesLeft: number;
  /** While setting up: the QR code picture and the key for typing in by hand. */
  setup: { qrDataUrl: string; secret: string } | null;
};

const muted = "text-sm text-slate-400 light:text-slate-500";

function FormMessage({ state }: { state: TwoFactorFormState }) {
  if (!state?.message) return null;
  return (
    <p role="alert" className="text-sm text-red-400 light:text-red-600">
      {state.message}
    </p>
  );
}

/** The recovery codes, shown once, with copy and download. */
function RecoveryCodes({ codes }: { codes: string[] }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  return (
    <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 light:border-amber-300 light:bg-amber-50">
      <p className="text-sm font-semibold text-amber-200 light:text-amber-800">Save these recovery codes now</p>
      <p className="text-sm text-amber-100/80 light:text-amber-900/80">
        If you lose your phone, each code signs you in once. They will not be shown again.
      </p>
      <ol className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-sm text-slate-100 light:text-slate-900">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy codes"}
        </Button>
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(`AIBOS recovery codes\n\n${text}\n`)}`}
          download="aibos-recovery-codes.txt"
          className={buttonStyles("secondary")}
        >
          <Download className="h-4 w-4" />
          Download
        </a>
        <Button type="button" onClick={() => router.refresh()}>
          Done, I saved them
        </Button>
      </div>
    </div>
  );
}

function SetupStep({ setup }: { setup: NonNullable<Props["setup"]> }) {
  const [state, action] = useActionState(confirmTwoFactor, undefined);
  if (state?.recoveryCodes) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300 light:text-emerald-700">
          <ShieldCheck className="h-4 w-4" />
          Two step sign in is on.
        </p>
        <RecoveryCodes codes={state.recoveryCodes} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <ol className={`list-decimal space-y-1 pl-5 ${muted}`}>
        <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password).</li>
        <li>Scan this code, or type the key by hand.</li>
        <li>Type the 6 digit code the app shows.</li>
      </ol>
      <div className="flex flex-wrap items-center gap-5">
        <Image src={setup.qrDataUrl} alt="QR code for your authenticator app" width={168} height={168} unoptimized className="rounded-lg bg-white p-2" />
        <div className="min-w-0">
          <p className={muted}>Key</p>
          <p className="mt-1 break-all font-mono text-sm tracking-wider text-slate-100 light:text-slate-900">
            {setup.secret.match(/.{1,4}/g)?.join(" ")}
          </p>
        </div>
      </div>
      <form action={action} className="grid gap-3 sm:max-w-xs">
        <div>
          <Label htmlFor="two-factor-code">6 digit code</Label>
          <Input id="two-factor-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required placeholder="123 456" />
        </div>
        <FormMessage state={state} />
        <div className="flex gap-2">
          <SubmitButton pendingText="Checking...">Turn on</SubmitButton>
          <Button type="submit" variant="ghost" formAction={cancelTwoFactorSetup} formNoValidate>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

function EnabledControls({ recoveryCodesLeft }: { recoveryCodesLeft: number }) {
  const [renewState, renewAction] = useActionState(regenerateRecoveryCodes, undefined);
  const [offState, offAction] = useActionState(disableTwoFactor, undefined);
  const [panel, setPanel] = useState<"none" | "codes" | "off">("none");

  return (
    <div className="space-y-4">
      <p className={muted}>
        {recoveryCodesLeft} of 10 recovery codes left.
        {recoveryCodesLeft <= 3 && <span className="text-amber-300 light:text-amber-700"> Make new ones soon.</span>}
      </p>
      {renewState?.recoveryCodes && <RecoveryCodes codes={renewState.recoveryCodes} />}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => setPanel(panel === "codes" ? "none" : "codes")}>
          New recovery codes
        </Button>
        <Button type="button" variant="ghost" onClick={() => setPanel(panel === "off" ? "none" : "off")}>
          <ShieldOff className="h-4 w-4" />
          Turn off
        </Button>
      </div>

      {panel === "codes" && !renewState?.recoveryCodes && (
        <form action={renewAction} className="grid gap-3 sm:max-w-xs">
          <p className={muted}>The old codes stop working.</p>
          <div>
            <Label htmlFor="renew-code">Code from your app</Label>
            <Input id="renew-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
          </div>
          <FormMessage state={renewState} />
          <div>
            <SubmitButton pendingText="Making codes...">Make new codes</SubmitButton>
          </div>
        </form>
      )}

      {panel === "off" && (
        <form action={offAction} className="grid gap-3 sm:max-w-xs">
          <p className={muted}>Signing in will need only your password again.</p>
          <div>
            <Label htmlFor="off-password">Password</Label>
            <Input id="off-password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <div>
            <Label htmlFor="off-code">Code from your app, or a recovery code</Label>
            <Input id="off-code" name="code" autoComplete="one-time-code" required />
          </div>
          <FormMessage state={offState} />
          <div>
            <SubmitButton variant="danger" pendingText="Turning off...">
              Turn off two step sign in
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}

/** My account card: two step sign in with an authenticator app. */
export function TwoFactorCard({ enabledAt, recoveryCodesLeft, setup }: Props) {
  return (
    <div className="mt-5 border-t border-white/[0.06] pt-4 light:border-slate-200">
      {enabledAt ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300 light:text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            On since {formatDate(enabledAt)}
          </p>
          <EnabledControls recoveryCodesLeft={recoveryCodesLeft} />
        </div>
      ) : setup ? (
        <SetupStep setup={setup} />
      ) : (
        <form action={startTwoFactorSetup} className="space-y-4">
          <p className={`flex items-start gap-2 ${muted}`}>
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
            After your password, sign in also asks for a code from an app on your phone. A stolen password alone is then not enough.
          </p>
          <SubmitButton pendingText="Preparing...">Set up two step sign in</SubmitButton>
        </form>
      )}
    </div>
  );
}
