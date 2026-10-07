import { KeyRound, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { updateMyName, changePassword } from "@/lib/actions/account";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { Input, Label } from "@/components/ui-dark/input";

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
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const user = await getCurrentUser();
  const { error, saved } = await searchParams;

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
              {saved === "password" ? "Password changed. Other devices have been signed out." : "Saved."}
            </div>
          )}
        </div>

        {/* Same width as the other settings pages; the two cards sit side by
            side on wide screens and stack on smaller ones. */}
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
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
        </div>
      </div>
    </div>
  );
}
