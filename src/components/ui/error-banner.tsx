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
  "mrp-disabled": "Planning is turned off for this company. Turn it on in the planning settings.",
  "bom-cycle": "That component already uses this product, so adding it would create a loop.",
  "not-made": "Only products with a bill of materials can be made. Add components to the product first.",
  "component-short": "Not enough components in stock to complete this work order.",
  "work-order-locked": "A completed work order can't be deleted because it has already moved stock.",
  "plan-changed": "The plan changed since this page loaded. Here is the latest version.",
  "no-supplier": "Set a preferred supplier on the product before creating a purchase order for it.",
};

export function ErrorBanner({ code }: { code?: string }) {
  if (!code || !MESSAGES[code]) return null;
  return (
    <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
      {MESSAGES[code]}
    </p>
  );
}
