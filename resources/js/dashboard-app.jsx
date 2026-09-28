import React from 'react';
import { createRoot } from 'react-dom/client';
import AppShell from './Components/AppShell';
import KpiDashboard from './Pages/Dashboard';   // ← import from Dashboard.jsx
import './shell.css';
import './dashboard.css';

const root = document.getElementById('dashboard-root');

if (root) {
    createRoot(root).render(
        <AppShell
            active="dashboard"
            title="KPI Dashboard"
            subtitle="Finished Goods Output"
        >
            <KpiDashboard />
        </AppShell>
    );
}