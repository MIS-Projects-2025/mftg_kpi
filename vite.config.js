import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    server: {
        host: '127.0.0.1',
    },

    plugins: [
        laravel({
            input: [
                'resources/js/app.jsx',
                'resources/js/team-dashboard-app.jsx',
                'resources/js/dashboard-app.jsx',
                'resources/js/fglist-app.jsx',
                'resources/js/hourly-app.jsx',
                'resources/js/scan-app.jsx',
                'resources/js/telford-out-app.jsx',
                'resources/js/loading-plan-app.jsx',
                'resources/js/lot-monitoring-app.jsx',

            ],
            refresh: true,
        }),

        react(),
    ],
});
