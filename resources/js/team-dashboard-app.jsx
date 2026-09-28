import React from 'react';
import { createRoot } from 'react-dom/client';
import AppShell from './Components/AppShell';
import TeamDashboard from './Pages/TeamDashboard';
import './shell.css';

const root = document.getElementById('team-dashboard-root');
if (root) {
    createRoot(root).render(
        <AppShell active="team-dashboard" title="Team Dashboard" subtitle="Plan vs Output per team per day">
            <TeamDashboard />
        </AppShell>
    );
}