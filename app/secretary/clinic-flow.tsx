"use client";

import { Suspense } from "react";
import { useDemoClinic } from "@/lib/demo-clinic";
import { ClinicFlowView } from "./clinic-flow-view";
import { PersistedFlow } from "./persisted-flow";

export function ClinicFlow(props: { route: string; demo?: boolean }) {
  return (
    <Suspense fallback={<p className="secretary-muted">جارٍ تحميل العرض…</p>}>
      {props.demo ? (
        <DemoFlow route={props.route} />
      ) : (
        <PersistedFlow route={props.route} />
      )}
    </Suspense>
  );
}

function DemoFlow({ route }: { route: string }) {
  const local = useDemoClinic();
  return <ClinicFlowView route={route} demo local={local} />;
}
