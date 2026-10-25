// Bundled only by the browser test. Never imported by an application route.
import React from "react";
import { createRoot } from "react-dom/client";
import { PersistedFlow } from "../../app/secretary/persisted-flow";
import { SecretaryAccountScreen } from "../../app/secretary/account/account-screen";
import "../../app/secretary/secretary.css";
import "../../app/doctor/doctor.css";

createRoot(document.getElementById("root")!).render(
  location.pathname.endsWith("/account") ? (
    <SecretaryAccountScreen
      name="اسم اختباري"
      email="synthetic@example.invalid"
      role={location.pathname.startsWith("/doctor") ? "doctor" : "secretary"}
    />
  ) : (
    <PersistedFlow route={location.pathname.slice(1)} />
  )
);
