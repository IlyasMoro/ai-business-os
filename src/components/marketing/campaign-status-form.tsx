"use client";

import { useRef } from "react";
import { Select } from "@/components/ui-dark/input";
import { updateCampaignStatus } from "@/lib/actions/marketing";

export function CampaignStatusForm({ campaignId, status }: { campaignId: string; status: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = updateCampaignStatus.bind(null, campaignId);

  return (
    <form ref={formRef} action={action}>
      <Select
        name="status"
        defaultValue={status}
        className="w-auto"
        onChange={() => formRef.current?.requestSubmit()}
      >
        <option value="DRAFT">Draft</option>
        <option value="ACTIVE">Active</option>
        <option value="PAUSED">Paused</option>
        <option value="COMPLETED">Completed</option>
      </Select>
    </form>
  );
}
