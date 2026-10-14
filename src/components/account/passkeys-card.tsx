"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { startRegistration, browserSupportsWebAuthn, WebAuthnError } from "@simplewebauthn/browser";
import { Fingerprint, Plus, Trash2 } from "lucide-react";
import { removePasskey } from "@/lib/actions/sign-in-methods";
import { Button } from "@/components/ui-dark/button";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { Input, Label } from "@/components/ui-dark/input";
import { formatDate } from "@/lib/utils";

export type PasskeyRow = { id: string; name: string; createdAt: string; lastUsedAt: string | null; backedUp: boolean };

const muted = "text-sm text-slate-400 light:text-slate-500";
const noSubscribe = () => () => {};

/** Why adding a passkey stopped, in plain words. Cancelling the device's
 *  prompt is not an error, so it says nothing. */
function explain(error: unknown): string | null {
  if (error instanceof WebAuthnError) {
    if (error.code === "ERROR_CEREMONY_ABORTED") return null;
    if (error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") return "This device already has a passkey for your account.";
  }
  if (error instanceof Error && error.name === "NotAllowedError") return null;
  return "The passkey wasn't added. Try again.";
}

/** The person's passkeys, with "Add a passkey" for this device. */
export function PasskeysCard({ passkeys, suggestedName }: { passkeys: PasskeyRow[]; suggestedName: string }) {
  const router = useRouter();
  const supported = useSyncExternalStore(noSubscribe, () => browserSupportsWebAuthn(), () => true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(suggestedName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setMessage(null);
    try {
      const options = await fetch("/api/auth/passkey/register/options", { method: "POST" }).then((r) => r.json());
      const response = await startRegistration({ optionsJSON: options });
      const result = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, name }),
      }).then((r) => r.json());
      if (!result.ok) {
        setMessage(result.error ?? "The passkey wasn't added. Try again.");
        return;
      }
      setAdding(false);
      router.refresh();
    } catch (error) {
      setMessage(explain(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-4 light:border-slate-200">
      {passkeys.length > 0 ? (
        <ul className="space-y-3">
          {passkeys.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Fingerprint className="h-5 w-5 shrink-0 text-cyan-300 light:text-cyan-700" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100 light:text-slate-900">{p.name}</p>
                  <p className={muted}>
                    Added {formatDate(p.createdAt)}
                    {p.lastUsedAt ? ` · last used ${formatDate(p.lastUsedAt)}` : " · not used yet"}
                    {p.backedUp ? " · synced to your other devices" : ""}
                  </p>
                </div>
              </div>
              <form action={removePasskey}>
                <input type="hidden" name="id" value={p.id} />
                <SubmitButton variant="ghost" pendingText="Removing...">
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Remove
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className={muted}>No passkeys yet. Add one to sign in with your fingerprint, face or device PIN instead of a password.</p>
      )}

      {!supported ? (
        <p className={muted}>This browser can&apos;t make passkeys. Try a current version of Chrome, Edge, Safari or Firefox.</p>
      ) : adding ? (
        <div className="space-y-3 rounded-xl border border-white/[0.08] p-4 light:border-slate-200">
          <div>
            <Label htmlFor="passkey-name">Name this passkey</Label>
            <Input id="passkey-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">So you can tell your devices apart later.</p>
          </div>
          {message && (
            <p role="alert" className="text-sm text-red-400 light:text-red-600">
              {message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={add} disabled={busy}>
              <Fingerprint className="h-4 w-4" aria-hidden />
              {busy ? "Waiting for your device..." : "Create passkey"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Add a passkey
        </Button>
      )}
    </div>
  );
}
