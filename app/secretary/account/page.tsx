import { getAccountProfile } from "@/lib/account-profile";
import { ClinicFlow } from "../clinic-flow";
export const instant = false;
export default async function Page() {
  return (
    <ClinicFlow route="secretary/account" profile={await getAccountProfile()} />
  );
}
