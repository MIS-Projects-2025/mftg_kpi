import React from 'react';
import { createRoot } from 'react-dom/client';
import AppShell from './Components/AppShell';
import DeliveryOrderBuilder from './Pages/DeliveryOrderBuilder';
import './shell.css';
import './delivery-order.css';

const root = document.getElementById('delivery-order-root');
if (root) {
    createRoot(root).render(
        <AppShell
            active="delivery-orders"
            title="Delivery Order Builder"
            subtitle="Price and issue a Delivery Order from the FGLIST data source"
        >
            <DeliveryOrderBuilder />
        </AppShell>
    );
}
