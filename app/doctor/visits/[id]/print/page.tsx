import type { Metadata } from "next";
import { getPrintPlan } from "@/backend/print-plan-server";
import { PrintScreen } from "@/frontend/doctor/print-plan/screen";

export const instant = false;
export const metadata: Metadata = {
  title: "البرنامج الغذائي — Mayaana",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PrintScreen result={await getPrintPlan(id)} />;
}
