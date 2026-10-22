import { MeasurementScreen } from "../../secretary/measurements/measurement-screen";
import { notFound } from "next/navigation";

export const instant = false;

export default async function Preview({
  params,
}: {
  params: Promise<{ mode: string }>;
}) {
  const { mode } = await params;
  if (mode !== "full-exam" && mode !== "previous" && mode !== "follow-up")
    notFound();
  return <MeasurementScreen key={mode} mode={mode} preview />;
}
