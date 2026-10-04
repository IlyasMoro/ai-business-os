import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/dal";
import { getCrmSettings } from "@/lib/crm-access";
import { whatsappNumber } from "@/lib/whatsapp";

/** What every WhatsApp button needs: the company's dialling code for local
 * numbers, and the names that go into the messages. */
export const getWhatsAppContext = cache(async () => {
  const user = await getCurrentUser();
  const settings = await getCrmSettings(user.companyId);
  const countryCode = settings?.whatsappCountryCode ?? "27";
  return {
    senderName: user.name,
    myCompany: user.company.name,
    number: (phone: string | null | undefined) => whatsappNumber(phone, countryCode),
  };
});
