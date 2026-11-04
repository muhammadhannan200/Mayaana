"use client";

import { Suspense } from "react";
import type { AccountProfile } from "@/backend/account-profile";
import { useDemoClinic } from "@/frontend/demo/demo-clinic";
import { ClinicFlowView } from "./clinic-flow-view";
import { PersistedFlow } from "./persisted-flow";

export function ClinicFlow(props: {
  route: string;
  demo?: boolean;
  profile?: AccountProfile | null;
}) {
  return (
    <Suspense fallback={<p className="secretary-muted">جارٍ تحميل العرض…</p>}>
      {props.demo ? (
        <DemoFlow route={props.route} />
      ) : (
        <PersistedFlow route={props.route} profile={props.profile} />
      )}
    </Suspense>
  );
}

function DemoFlow({ route }: { route: string }) {
  const local = useDemoClinic();
  return <ClinicFlowView route={route} demo local={local} />;
}
