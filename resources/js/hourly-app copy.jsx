import React from 'react';
import { createRoot } from 'react-dom/client';

import AppShell from './Components/AppShell';
import HourlyOutput from './Pages/HourlyOutput';

import './shell.css';


const root = document.getElementById('hourly-root');


if(root){

    createRoot(root).render(
        <AppShell
            active="hourly"
            title="Hourly Output Logs"
            subtitle="Production hourly monitoring"
        >
            <HourlyOutput />
        </AppShell>
    );

}