import { Input, Select, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { createCalendarEvent } from "@/lib/actions/calendar";

export function EventForm() {
  return (
    <form action={createCalendarEvent} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
      <div className="col-span-2 sm:col-span-2">
        <Input name="title" placeholder="Title" required />
      </div>
      <div>
        <Select name="type" defaultValue="MEETING">
          <option value="MEETING">Meeting</option>
          <option value="REMINDER">Reminder</option>
          <option value="OTHER">Other</option>
        </Select>
      </div>
      <div>
        <Input name="startAt" type="datetime-local" required />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <Textarea name="description" placeholder="Notes (optional)" rows={1} />
      </div>
      <SubmitButton variant="secondary" pendingText="Adding...">
        Add event
      </SubmitButton>
    </form>
  );
}
