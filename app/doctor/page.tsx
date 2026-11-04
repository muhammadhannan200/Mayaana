import { ClinicFlow } from "@/frontend/secretary/clinic-flow";
import { getAccountProfile } from "@/backend/account-profile";
export const instant = false;
export default async function Page() {
  return <ClinicFlow route="doctor" profile={await getAccountProfile()} />;
}
