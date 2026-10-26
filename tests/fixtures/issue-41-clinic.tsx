// Bundled only by the browser test. Never imported by an application route.
import React from "react";
import { createRoot } from "react-dom/client";
import { PersistedFlow } from "../../app/secretary/persisted-flow";
import { DoctorNav } from "../../app/secretary/clinic-ui";
import "../../app/secretary/secretary.css";
import "../../app/doctor/doctor.css";

createRoot(document.getElementById("root")!).render(
  // Component-only active-state fixture, not a replacement for the staff page.
  location.pathname === "/doctor/staff" ? (
    <main className="doctor-shell persisted-clinic" dir="rtl">
      <div className="doctor-scroll">
        <h1>حالة تنقل الحساب</h1>
      </div>
      <DoctorNav route="doctor/staff" />
    </main>
  ) : (
    <PersistedFlow route={location.pathname.slice(1)} />
  )
);
