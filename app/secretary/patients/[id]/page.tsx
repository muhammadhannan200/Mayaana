import { ClinicFlow } from "../../clinic-flow";
export const instant = false;
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClinicFlow route={`secretary/patients/${id}`} />;
}
