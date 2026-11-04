import Link from "next/link";
import { printMessages, type PrintResult } from "@/lib/print-plan";
import { PrintDocument } from "./document";
import { PrintButton } from "./print-button";
import "./print.css";

export function PrintScreen({
  result,
  demo = false,
}: {
  result: PrintResult;
  demo?: boolean;
}) {
  return (
    <main className="print-shell" dir="rtl" lang="ar">
      <nav className="print-controls" aria-label="إجراءات الطباعة">
        <Link href={demo ? "/demo/doctor" : "/doctor"}>العودة للطبيب</Link>
        {result.kind === "ready" && <PrintButton />}
      </nav>
      {result.kind === "ready" ? (
        <PrintDocument plan={result.plan} demo={demo} />
      ) : (
        <section className="print-document">
          <h1>البرنامج غير متاح للطباعة</h1>
          <p role="status">{printMessages[result.kind]}</p>
        </section>
      )}
    </main>
  );
}
