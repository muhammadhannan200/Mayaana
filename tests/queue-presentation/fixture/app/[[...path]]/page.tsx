import { Suspense } from "react";
import { PersistedFlow } from "@/app/secretary/persisted-flow";

export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = ["secretary"] } = await params;
  return (
    <Suspense fallback={<p>تحميل المعاينة…</p>}>
      <PersistedFlow route={path.join("/")} />
    </Suspense>
  );
}
