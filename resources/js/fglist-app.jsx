import React from 'react';
import { createRoot } from 'react-dom/client';
import AppShell from './Components/AppShell';
import FGList from './Pages/FGList';

import './shell.css';

const root = document.getElementById('fglist-root');

if (root) {
    createRoot(root).render(
        <AppShell
            active="fglist"
            title="Finished Goods List"
            subtitle="Finished Goods Log Entry"
        >
            <FGList />
        </AppShell>
    );
}
