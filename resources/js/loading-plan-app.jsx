import React from 'react';
import { createRoot } from 'react-dom/client';
import AppShell from './Components/AppShell';
import LoadingPlan from './Pages/LoadingPlan';
import './shell.css';

const root = document.getElementById('loading-plan-root');
if (root) {
    createRoot(root).render(
        <AppShell active="loading-plan" title="Loading Plan" subtitle="Backend WIP by Station · F1 & F2">
            <LoadingPlan />
        </AppShell>
    );
}