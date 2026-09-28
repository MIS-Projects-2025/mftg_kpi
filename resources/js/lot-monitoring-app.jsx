import React from 'react';
import { createRoot } from 'react-dom/client';
import AppShell from './Components/AppShell';
import LotMonitoring from './Pages/LotMonitoring';
import './shell.css';

const root = document.getElementById('lot-monitoring-root');
if (root) {
    createRoot(root).render(
        <AppShell active="lot-monitoring" title="Lot Monitoring" subtitle="Plan vs Actual per Lot">
            <LotMonitoring />
        </AppShell>
    );
}
