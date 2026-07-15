import Link from "next/link";
import { LinkButton } from "@/components/ui-dark/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center light:bg-white">
      <p className="text-sm font-semibold text-blue-400">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-50 light:text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-500">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <div className="mt-6">
        <LinkButton href="/">Go home</LinkButton>
      </div>
      <p className="mt-4 text-sm">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-200 light:text-slate-500 light:hover:text-slate-700">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
