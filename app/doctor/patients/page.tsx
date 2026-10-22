import { ClinicFlow } from "@/app/secretary/clinic-flow";
export const instant = false;
export default function Page() {
  return <ClinicFlow route="doctor/patients" />;
}
