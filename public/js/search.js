// Global search functionality

let searchTimeout = null;
let searchCache = { companies: [], sites: [], subsites: [] };

// Load search data
async function loadSearchData() {
    try {
        const [companies, sites, subsites] = await Promise.all([
            API.getCompanies(),
            API.getSites(),
            API.getSubsites()
        ]);
        searchCache = { companies, sites, subsites };
    } catch (e) {
        console.error('Failed to load search data:', e);
    }
}

// Initialize search on page load
document.addEventListener('DOMContentLoaded', loadSearchData);

// Handle search input
function handleSearch(event) {
    const query = event.target.value.trim().toLowerCase();

    // Clear existing timeout
    if (searchTimeout) clearTimeout(searchTimeout);

    if (query.length < 2) {
        hideSearchResults();
        return;
    }

    // Debounce search
    searchTimeout = setTimeout(() => {
        performSearch(query);
    }, 150);

    // Handle enter key for first result
    if (event.key === 'Enter') {
        const firstResult = document.querySelector('#search-results .search-result-item');
        if (firstResult) firstResult.click();
    }
}

// Perform search across all entities
function performSearch(query) {
    const results = [];

    // Search companies
    for (const c of searchCache.companies) {
        if (matchesQuery(c, ['name', 'ticker'], query)) {
            results.push({
                type: 'company',
                id: c.id,
                title: c.name,
                subtitle: c.ticker ? `${c.ticker} - ${c.site_count} sites` : `${c.site_count} sites`,
                icon: 'C'
            });
        }
    }

    // Search sites
    for (const s of searchCache.sites) {
        if (matchesQuery(s, ['name', 'city', 'state', 'company_name'], query)) {
            results.push({
                type: 'site',
                id: s.id,
                title: s.name,
                subtitle: `${s.company_name} - ${s.city || ''}, ${s.state || ''}`,
                icon: 'S'
            });
        }
    }

    // Search subsites
    for (const sub of searchCache.subsites) {
        if (matchesQuery(sub, ['name', 'site_name', 'company_name'], query)) {
            results.push({
                type: 'subsite',
                id: sub.id,
                title: sub.name,
                subtitle: `${sub.company_name} / ${sub.site_name}`,
                icon: 'P'
            });
        }
    }

    displaySearchResults(results.slice(0, 10)); // Limit to 10 results
}

// Check if entity matches query
function matchesQuery(entity, fields, query) {
    for (const field of fields) {
        const value = entity[field];
        if (value && String(value).toLowerCase().includes(query)) {
            return true;
        }
    }
    return false;
}

// Display search results
function displaySearchResults(results) {
    const container = document.getElementById('search-results');

    if (results.length === 0) {
        container.innerHTML = '<div class="p-3 text-gray-400 text-sm">No results found</div>';
        container.classList.remove('hidden');
        return;
    }

    container.innerHTML = results.map(r => `
        <div class="search-result-item flex items-center p-2 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-0"
             onclick="navigateToSearchResult('${r.type}', ${r.id})">
            <div class="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-xs font-medium mr-3 ${
                r.type === 'company' ? 'text-orange-400' :
                r.type === 'site' ? 'text-blue-400' : 'text-green-400'
            }">${r.icon}</div>
            <div class="flex-1 min-w-0">
                <div class="font-medium text-sm truncate">${r.title}</div>
                <div class="text-xs text-gray-400 truncate">${r.subtitle}</div>
            </div>
            <div class="text-xs text-gray-500 ml-2">${r.type}</div>
        </div>
    `).join('');

    container.classList.remove('hidden');
}

// Navigate to search result
function navigateToSearchResult(type, id) {
    hideSearchResults();
    document.getElementById('global-search').value = '';

    switch (type) {
        case 'company':
            navigate('company', { id });
            break;
        case 'site':
            navigate('site', { id });
            break;
        case 'subsite':
            navigate('subsite', { id });
            break;
    }
}

// Show search results container
function showSearchResults() {
    const query = document.getElementById('global-search').value.trim();
    if (query.length >= 2) {
        document.getElementById('search-results').classList.remove('hidden');
    }
}

// Hide search results container
function hideSearchResults() {
    document.getElementById('search-results').classList.add('hidden');
}

// Keyboard shortcuts
document.addEventListener('keydown', (event) => {
    // Ctrl+K or Cmd+K to focus search
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        document.getElementById('global-search').focus();
    }

    // Ctrl+N to add new entry based on current page
    if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        handleNewEntry();
    }

    // ? to toggle help
    if (event.key === '?' && !isInputFocused()) {
        document.getElementById('shortcuts-help').classList.toggle('hidden');
    }

    // Escape to close modal or clear search
    if (event.key === 'Escape') {
        const modal = document.getElementById('modal');
        if (!modal.classList.contains('hidden')) {
            closeModal();
        } else {
            document.getElementById('global-search').value = '';
            hideSearchResults();
            document.getElementById('global-search').blur();
        }
    }

    // Number keys 1-7 for navigation when not in input
    if (!isInputFocused() && event.key >= '1' && event.key <= '7') {
        const pages = ['dashboard', 'companies', 'sites', 'news', 'review', 'valuation', 'settings'];
        const pageIndex = parseInt(event.key) - 1;
        if (pages[pageIndex]) {
            navigate(pages[pageIndex]);
        }
    }
});

// Check if an input is focused
function isInputFocused() {
    const active = document.activeElement;
    return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
}

// Handle new entry based on current page
function handleNewEntry() {
    switch (currentPage) {
        case 'companies':
            showCompanyForm();
            break;
        case 'sites':
            showSiteForm();
            break;
        case 'company':
            // Get company ID from URL or context
            const companyId = getPageParam('id');
            if (companyId) showSiteForm(null, companyId);
            break;
        case 'site':
            const siteId = getPageParam('id');
            if (siteId) showSubsiteForm(null, siteId);
            break;
        case 'news':
            showNewsForm();
            break;
        default:
            showCompanyForm();
    }
}

// Get parameter from page navigation
function getPageParam(param) {
    // Simple extraction from last navigation params
    if (window.lastNavParams && window.lastNavParams[param]) {
        return window.lastNavParams[param];
    }
    return null;
}

// Refresh search cache when data changes
function refreshSearchCache() {
    loadSearchData();
}
