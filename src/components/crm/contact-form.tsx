import { Input } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { createContact } from "@/lib/actions/crm";

export function ContactForm({ customerId }: { customerId: string }) {
  const action = createContact.bind(null, customerId);

  return (
    <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="col-span-2 sm:col-span-1">
        <Input name="name" placeholder="Name" required />
      </div>
      <div>
        <Input name="role" placeholder="Role" />
      </div>
      <div>
        <Input name="email" type="email" placeholder="Email" />
      </div>
      <div>
        <Input name="phone" placeholder="Phone" />
      </div>
      <SubmitButton variant="secondary" pendingText="Adding...">
        Add contact
      </SubmitButton>
    </form>
  );
}
