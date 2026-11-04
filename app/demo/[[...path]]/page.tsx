import { notFound } from "next/navigation";
import { DemoClinicProvider } from "@/lib/demo-clinic";
import { ClinicFlow } from "@/app/secretary/clinic-flow";
import { DemoPrintPlan } from "@/app/doctor/print-plan/demo";
import "@/app/doctor/doctor.css";
export const instant = false;

export default async function DemoPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = ["secretary"] } = await params;
  const route = path.join("/");
  const print = /^doctor\/visits\/([^/]+)\/print$/.exec(route);
  if (print)
    return (
      <DemoClinicProvider scope="public">
        <DemoPrintPlan entryId={print[1]} />
      </DemoClinicProvider>
    );
  if (
    !/^(secretary(?:\/(?:add|search|confirm|account|patients(?:\/new)?|measurements\/(?:follow-up|previous|full-exam)))?|doctor(?:\/(?:search|patients(?:\/[^/]+)?|visits\/[^/]+))?)$/.test(
      route
    )
  )
    notFound();
  return (
    <DemoClinicProvider scope="public">
      <ClinicFlow route={route} demo />
    </DemoClinicProvider>
  );
}
