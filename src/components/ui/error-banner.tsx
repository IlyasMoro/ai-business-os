const MESSAGES: Record<string, string> = {
  forbidden: "You don't have permission to perform that action.",
  "in-use": "This record can't be deleted because it's referenced elsewhere.",
  invalid: "Please check the form for errors and try again.",
  confirm: "The confirmation text didn't match. Nothing was deleted.",
  "no-email": "This customer doesn't have an email address on file, so the invoice couldn't be sent.",
  "send-failed": "The invoice couldn't be sent. Check your email configuration and try again.",
  "last-owner": "You can't remove the last owner of a company.",
  "returns-disabled": "Returns are turned off for this company. Turn them on in the return policy.",
  "not-returnable": "Only fulfilled orders can be returned.",
  "return-window": "This order is outside the return window set in your return policy.",
  "return-qty": "That quantity is more than can still be returned for this item.",
  "return-locked": "This return can no longer be changed because the goods have already been received.",
  "return-empty": "Add at least one item before moving this return forward.",
};

export function ErrorBanner({ code }: { code?: string }) {
  if (!code || !MESSAGES[code]) return null;
  return (
    <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
      {MESSAGES[code]}
    </p>
  );
}
