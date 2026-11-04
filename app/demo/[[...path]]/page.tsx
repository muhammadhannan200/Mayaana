import { notFound } from "next/navigation";
import { DemoClinicProvider } from "@/frontend/demo/demo-clinic";
import { ClinicFlow } from "@/frontend/secretary/clinic-flow";
import { DemoPrintPlan } from "@/frontend/doctor/print-plan/demo";
import "@/frontend/doctor/doctor.css";
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
    !/^(secretary(?:\/(?:add|search|confirm|account|patients(?:\/[^/]+(?:\/edit)?)?|measurements\/(?:follow-up|previous|full-exam)))?|doctor(?:\/(?:week|search|patients(?:\/[^/]+)?|visits\/[^/]+))?)$/.test(
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
