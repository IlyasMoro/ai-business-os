import { KeyRound, LogIn, ShieldCheck, UserRound } from "lucide-react";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/dal";
import { updateMyName, changePassword } from "@/lib/actions/account";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { Input, Label } from "@/components/ui-dark/input";
import { buttonStyles } from "@/components/ui-dark/button";
import { TwoFactorCard } from "@/components/account/two-factor-card";
import { db } from "@/lib/db";
import { openSecret } from "@/lib/secret-box";
import { otpauthUrl } from "@/lib/totp";
import { enabledProviders, providerLabel } from "@/lib/oauth-login";
import { unlinkExternalLogin } from "@/lib/actions/sign-in-methods";

export const metadata = { title: "My account" };

const ROLE_LABEL = { OWNER: "Owner", ADMIN: "Admin", EMPLOYEE: "Employee" } as const;

function CardHead({ icon: Icon, title, text }: { icon: typeof UserRound; title: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/5 text-slate-300 light:border-slate-200 light:text-slate-600">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-semibold text-slate-50 light:text-slate-900">{title}</p>
        <p className="text-sm text-slate-400 light:text-slate-500">{text}</p>
      </div>
    </div>
  );
}

/** The signed-in person's own details and password. Company details are on Settings. */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; left?: string; oauth?: string }>;
}) {
  const user = await getCurrentUser();
  const { error, saved, left, oauth } = await searchParams;

  const security = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      twoFactorEnabledAt: true,
      twoFactorPendingSecret: true,
      twoFactorRecoveryCodes: true,
      externalLogins: { select: { provider: true, email: true } },
    },
  });
  // Setting up: the QR code for the app, made here so the secret never
  // leaves the server except as the picture and the typed key.
  const pendingSecret = !security.twoFactorEnabledAt && security.twoFactorPendingSecret ? openSecret(security.twoFactorPendingSecret) : null;
  const setup = pendingSecret
    ? { secret: pendingSecret, qrDataUrl: await QRCode.toDataURL(otpauthUrl({ secret: pendingSecret, account: user.email }), { margin: 1, width: 336 }) }
    : null;
  const providers = enabledProviders();
  const savedText: Record<string, string> = {
    password: "Password changed. Other devices have been signed out.",
    "two-factor-off": "Two step sign in is off.",
    "linked-google": "Google connected. You can now sign in with it.",
    "linked-microsoft": "Microsoft connected. You can now sign in with it.",
    unlinked: "Disconnected. Your password still works.",
    "recovery-used": `You signed in with a recovery code. ${left ?? "Some"} left: make new ones below if you are running low.`,
  };
  const oauthError: Record<string, string> = {
    failed: "Connecting didn't finish. Try again.",
    taken: "That account is already connected to another AIBOS user.",
  };

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">My account</h1>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
          Signed in as {user.email} · {ROLE_LABEL[user.role]} at {user.company.name}
        </p>

        <div className="mt-4 space-y-3">
          <ErrorBanner code={error} />
          {saved && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">
              {savedText[saved] ?? "Saved."}
            </div>
          )}
          {oauth && oauthError[oauth] && (
            <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 light:text-red-700">
              {oauthError[oauth]}
            </div>
          )}
        </div>

        {/* Same width as the other settings pages; the two cards sit side by
            side on wide screens and stack on smaller ones. */}
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="rounded-2xl border border-white/[0.09] p-5 glass light:border-white/80">
          <CardHead icon={UserRound} title="Your details" text="How your name appears to your team and on records you create." />
          <form action={updateMyName} className="mt-5 grid gap-4 border-t border-white/[0.06] pt-4 light:border-slate-200">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={user.name} minLength={2} maxLength={100} required autoComplete="name" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" defaultValue={user.email} disabled aria-describedby="email-note" />
              <p id="email-note" className="mt-1 text-xs text-slate-500">
                Your sign in email. Ask an owner if it needs to change.
              </p>
            </div>
            <div>
              <SubmitButton pendingText="Saving...">Save name</SubmitButton>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-white/[0.09] p-5 glass light:border-white/80">
          <CardHead icon={KeyRound} title="Password" text="Changing it signs you out on every other device." />
          <form action={changePassword} className="mt-5 grid gap-4 border-t border-white/[0.06] pt-4 light:border-slate-200">
            <div>
              <Label htmlFor="current">Current password</Label>
              <Input id="current" name="current" type="password" required autoComplete="current-password" />
            </div>
            <div>
              <Label htmlFor="next">New password</Label>
              <Input id="next" name="next" type="password" minLength={8} required autoComplete="new-password" />
              <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
            </div>
            <div>
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input id="confirm" name="confirm" type="password" minLength={8} required autoComplete="new-password" />
            </div>
            <div>
              <SubmitButton pendingText="Changing...">Change password</SubmitButton>
            </div>
          </form>
        </div>

        <div id="two-factor" className="scroll-mt-6 rounded-2xl border border-white/[0.09] p-5 glass light:border-white/80">
          <CardHead icon={ShieldCheck} title="Two step sign in" text="A code from your phone after your password." />
          <TwoFactorCard
            enabledAt={security.twoFactorEnabledAt?.toISOString() ?? null}
            recoveryCodesLeft={security.twoFactorRecoveryCodes.length}
            setup={setup}
          />
        </div>

        {providers.length > 0 && (
          <div id="sign-in-methods" className="scroll-mt-6 rounded-2xl border border-white/[0.09] p-5 glass light:border-white/80">
            <CardHead icon={LogIn} title="Google and Microsoft" text="Sign in with an account you already use." />
            <ul className="mt-5 space-y-3 border-t border-white/[0.06] pt-4 light:border-slate-200">
              {providers.map((provider) => {
                const linked = security.externalLogins.find((l) => l.provider === provider);
                return (
                  <li key={provider} className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-100 light:text-slate-900">{providerLabel(provider)}</p>
                      <p className="text-sm text-slate-400 light:text-slate-500">{linked ? `Connected as ${linked.email}` : "Not connected"}</p>
                    </div>
                    {linked ? (
                      <form action={unlinkExternalLogin}>
                        <input type="hidden" name="provider" value={provider} />
                        <SubmitButton variant="ghost" pendingText="Disconnecting...">
                          Disconnect
                        </SubmitButton>
                      </form>
                    ) : (
                      // A plain link: the browser leaves for the provider and comes back.
                      <a href={`/api/auth/oauth/${provider}?mode=link`} className={buttonStyles("secondary")}>
                        Connect
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
