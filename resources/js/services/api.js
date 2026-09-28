import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
    },
});

// Laravel Sanctum / session CSRF token, if present on the page.
const token = document.querySelector('meta[name="csrf-token"]');
if (token) {
    api.defaults.headers.common['X-CSRF-TOKEN'] = token.getAttribute('content');
}

export default api;
