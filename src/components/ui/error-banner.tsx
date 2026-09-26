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
  "edi-setup": "Set up your EDI identity in the EDI settings first.",
  "edi-no-partner": "No enabled trading partner is set up to receive this document.",
  "edi-separators": "Separators must each be one symbol, all different, and not a letter, digit or space.",
  "edi-duplicate-partner": "A trading partner with that qualifier and ID already exists.",
  "edi-empty": "Add at least one line before generating an EDI document.",
  "edi-not-shipped": "A ship notice can only be sent once the order is fulfilled.",
  "edi-too-large": "EDI files can be at most 1MB.",
  "co-duplicate": "A cost center with that code already exists.",
  "branch-duplicate": "A branch with that code already exists.",
  "branch-main": "The main branch can't be deactivated. Make another branch the main one first.",
  "branch-inactive": "That branch is inactive. Reactivate it on the Branches page first.",
  "transfer-same-branch": "Choose two different branches to move stock between.",
  "transfer-locked": "This transfer has already been sent, so it can't be changed.",
  "transfer-empty": "Add at least one product before sending.",
  "transfer-changed": "This transfer or its stock changed while you were working. Check it and try again.",
  "co-in-use": "This cost center has carried costs or employees, so it can't be deleted. Mark it inactive instead.",
  "co-settled": "This internal order is already settled and can't be changed.",
  "co-no-receiver": "Choose a cost center to settle to before settling this order.",
  "co-shares": "Receivers must be different from the sender, each listed once, with shares adding up to 100%.",
  "co-already-run": "This allocation has already run for that month. Reverse that run first to run it again.",
  "lots-needed": "This order has lot or serial tracked products. Enter their lot numbers or serials to receive it.",
  "lot-short": "Not enough usable lots of a tracked component to complete this. Expired lots may be blocked in inventory settings.",
  "co-nothing": "The sender cost center has no cost in that month, so there is nothing to allocate.",
};

export function ErrorBanner({ code }: { code?: string }) {
  if (!code || !MESSAGES[code]) return null;
  return (
    <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
      {MESSAGES[code]}
    </p>
  );
}
