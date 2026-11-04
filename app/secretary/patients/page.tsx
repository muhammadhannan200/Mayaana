import { ClinicFlow } from "../../../frontend/secretary/clinic-flow";
export const instant = false;
export default function Page() {
  return <ClinicFlow route="secretary/patients" />;
}
