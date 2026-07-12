import React from "react";
import { createRoot } from "react-dom/client";
import GoogleAuthGate from "./app/google-auth-gate";
import "./app/globals.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GoogleAuthGate />
  </React.StrictMode>,
);
