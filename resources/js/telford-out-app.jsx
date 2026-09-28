import React from 'react';
import { createRoot } from 'react-dom/client';
import AppShell from './Components/AppShell';
import TelfordOut from './Pages/TelfordOut';
import './shell.css';

const root = document.getElementById('telford-out-root');
if (root) {
    createRoot(root).render(
        <AppShell active="telford-out" title="Telford Out" subtitle="CSV upload and output records">
            <TelfordOut />
        </AppShell>
    );
}