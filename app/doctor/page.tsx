import { ClinicFlow } from "@/app/secretary/clinic-flow";
import { getAccountProfile } from "@/lib/account-profile";
export const instant = false;
export default async function Page() {
  return <ClinicFlow route="doctor" profile={await getAccountProfile()} />;
}
