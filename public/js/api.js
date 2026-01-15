// API helper functions

const API = {
    // Generic request helper
    async request(method, url, data = null) {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (data) {
            options.body = JSON.stringify(data);
        }
        const res = await fetch(url, options);
        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.error || 'Request failed');
        }
        return json;
    },

    // Companies
    getCompanies: () => API.request('GET', '/api/companies'),
    getCompany: (id) => API.request('GET', `/api/companies/${id}`),
    createCompany: (data) => API.request('POST', '/api/companies', data),
    updateCompany: (id, data) => API.request('PUT', `/api/companies/${id}`, data),
    deleteCompany: (id) => API.request('DELETE', `/api/companies/${id}`),

    // Sites
    getSites: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return API.request('GET', `/api/sites${query ? '?' + query : ''}`);
    },
    getSite: (id) => API.request('GET', `/api/sites/${id}`),
    createSite: (data) => API.request('POST', '/api/sites', data),
    updateSite: (id, data) => API.request('PUT', `/api/sites/${id}`, data),
    deleteSite: (id) => API.request('DELETE', `/api/sites/${id}`),

    // Subsites
    getSubsites: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return API.request('GET', `/api/subsites${query ? '?' + query : ''}`);
    },
    getSubsite: (id) => API.request('GET', `/api/subsites/${id}`),
    createSubsite: (data) => API.request('POST', '/api/subsites', data),
    updateSubsite: (id, data) => API.request('PUT', `/api/subsites/${id}`, data),
    deleteSubsite: (id) => API.request('DELETE', `/api/subsites/${id}`),

    // Hardware
    getHardware: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return API.request('GET', `/api/hardware${query ? '?' + query : ''}`);
    },
    createHardware: (data) => API.request('POST', '/api/hardware', data),
    updateHardware: (id, data) => API.request('PUT', `/api/hardware/${id}`, data),
    deleteHardware: (id) => API.request('DELETE', `/api/hardware/${id}`),

    // News
    getNews: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return API.request('GET', `/api/news${query ? '?' + query : ''}`);
    },
    getNewsItem: (id) => API.request('GET', `/api/news/${id}`),
    createNews: (data) => API.request('POST', '/api/news', data),
    updateNews: (id, data) => API.request('PUT', `/api/news/${id}`, data),
    deleteNews: (id) => API.request('DELETE', `/api/news/${id}`),

    // Review queue
    getReviewQueue: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return API.request('GET', `/api/review${query ? '?' + query : ''}`);
    },
    createReviewItem: (data) => API.request('POST', '/api/review', data),
    decideReview: (id, action, notes) => API.request('POST', `/api/review/${id}/decide`, { action, reviewer_notes: notes }),

    // Settings
    getSettings: () => API.request('GET', '/api/settings'),
    updateSetting: (key, value) => API.request('PUT', `/api/settings/${key}`, { value }),
    createMultiplier: (data) => API.request('POST', '/api/multipliers', data),
    updateMultiplier: (id, data) => API.request('PUT', `/api/multipliers/${id}`, data),
    deleteMultiplier: (id) => API.request('DELETE', `/api/multipliers/${id}`),

    // Valuation
    getCompanyValuation: (id) => API.request('GET', `/api/valuation/company/${id}`),
    getAllValuations: () => API.request('GET', '/api/valuation/all'),

    // Stats
    getStats: () => API.request('GET', '/api/stats'),

    // Export
    exportData: (type, format = 'json') => {
        window.open(`/api/export/${type}?format=${format}`, '_blank');
    }
};

// Format helpers
const Format = {
    number: (n, decimals = 0) => {
        if (n === null || n === undefined) return '-';
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(n);
    },

    currency: (n, decimals = 0) => {
        if (n === null || n === undefined) return '-';
        if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
        if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
        if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
        return '$' + Format.number(n, decimals);
    },

    mw: (n) => {
        if (n === null || n === undefined) return '-';
        return Format.number(n, 1) + ' MW';
    },

    eh: (n) => {
        if (n === null || n === undefined) return '-';
        return Format.number(n, 2) + ' EH/s';
    },

    btc: (n) => {
        if (n === null || n === undefined) return '-';
        return Format.number(n, 2) + ' BTC';
    },

    percent: (n) => {
        if (n === null || n === undefined) return '-';
        return (n * 100).toFixed(1) + '%';
    },

    date: (d) => {
        if (!d) return '-';
        return new Date(d).toLocaleDateString();
    },

    status: (s) => {
        if (!s) return '';
        return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
};
