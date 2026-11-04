import { getAccountProfile } from "@/backend/account-profile";
import { ClinicFlow } from "../../../frontend/secretary/clinic-flow";
export const instant = false;
export default async function Page() {
  return (
    <ClinicFlow route="secretary/account" profile={await getAccountProfile()} />
  );
}
