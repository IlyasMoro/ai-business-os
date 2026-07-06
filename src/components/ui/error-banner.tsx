const MESSAGES: Record<string, string> = {
  forbidden: "You don't have permission to perform that action.",
  "in-use": "This record can't be deleted because it's referenced elsewhere.",
};

export function ErrorBanner({ code }: { code?: string }) {
  if (!code || !MESSAGES[code]) return null;
  return (
    <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
      {MESSAGES[code]}
    </p>
  );
}
