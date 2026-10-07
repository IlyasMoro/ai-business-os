import { redirect } from "next/navigation";
import { KeyRound, LockKeyhole, Smartphone } from "lucide-react";
import { readSecondStep } from "@/lib/session";
import { AuthShell } from "@/components/auth/auth-shell";
import { SecondStepForm } from "@/components/auth/second-step-form";

export const metadata = {
  title: "Two step sign in",
};

/* Second step of signing in, for people with two step sign in turned on:
   reached only with the short lived ticket a correct password leaves. */
export default async function VerifyPage() {
  if (!(await readSecondStep())) redirect("/login?expired=1");

  return (
    <AuthShell
      title="Check your app"
      sub="Your password was right. Enter the code from your authenticator app to finish signing in."
      panelEyebrow="Two step sign in"
      panelTitle="A stolen password alone is not enough."
      points={[
        { icon: Smartphone, text: "Codes come from the app on your phone" },
        { icon: LockKeyhole, text: "Each code works once and lasts 30 seconds" },
        { icon: KeyRound, text: "No phone? A recovery code gets you in" },
      ]}
    >
      <SecondStepForm />
    </AuthShell>
  );
}
