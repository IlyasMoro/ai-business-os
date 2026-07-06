import Link from "next/link";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 text-center">
      <p className="text-sm font-semibold text-indigo-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <div className="mt-6">
        <LinkButton href="/">Go home</LinkButton>
      </div>
      <p className="mt-4 text-sm">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-700">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
