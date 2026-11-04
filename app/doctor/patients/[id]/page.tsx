import { ClinicFlow } from "@/frontend/secretary/clinic-flow";
export const instant = false;
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClinicFlow route={`doctor/patients/${id}`} />;
}
