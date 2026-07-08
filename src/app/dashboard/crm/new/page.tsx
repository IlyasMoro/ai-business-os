import { CustomerForm } from "@/components/crm/customer-form";
import { createCustomer } from "@/lib/actions/crm";

export default function NewCustomerPage() {
  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-slate-950 p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-white">New customer</h1>
      <div className="mt-6">
        <CustomerForm action={createCustomer} submitLabel="Create customer" />
      </div>
    </div>
  );
}
