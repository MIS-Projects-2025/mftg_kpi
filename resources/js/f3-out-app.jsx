import React from "react";
import { createRoot } from "react-dom/client";
import AppShell from "./Components/AppShell";
import F3Out from "./Pages/F3Out";
import "./shell.css";

const root = document.getElementById("f3-out-root");
if (root) {
    createRoot(root).render(
        <AppShell
            active="f3-out"
            title="F3 Out"
            subtitle="Excel upload and output records"
        >
            <F3Out />
        </AppShell>,
    );
}
