// Bitcoin Mining Tracker - Main Application

let currentPage = 'dashboard';
let companiesCache = [];

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Load initial data
    await Valuation.loadSettings();
    await loadCompaniesCache();
    await updatePendingBadge();

    // Navigate to initial page
    const hash = window.location.hash.slice(1) || 'dashboard';
    navigate(hash);
});

// Navigation
function navigate(page, params = {}) {
    currentPage = page;
    window.lastNavParams = params; // Store for keyboard shortcuts
    window.location.hash = page;

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });

    // Render page
    const app = document.getElementById('app');
    app.innerHTML = '<div class="loading h-48"></div>';

    switch (page) {
        case 'dashboard': renderDashboard(); break;
        case 'companies': renderCompanies(); break;
        case 'company': renderCompanyDetail(params.id); break;
        case 'sites': renderSites(); break;
        case 'site': renderSiteDetail(params.id); break;
        case 'subsite': renderSubsiteDetail(params.id); break;
        case 'news': renderNews(); break;
        case 'review': renderReviewQueue(); break;
        case 'valuation': renderValuation(); break;
        case 'settings': renderSettings(); break;
        default: renderDashboard();
    }
}

// Load companies for dropdowns
async function loadCompaniesCache() {
    try {
        companiesCache = await API.getCompanies();
    } catch (e) {
        console.error('Failed to load companies:', e);
    }
}

// Update pending badge in nav
async function updatePendingBadge() {
    try {
        const stats = await API.getStats();
        const total = stats.pendingNews + stats.pendingReview;
        const badge = document.getElementById('pending-badge');
        if (total > 0) {
            badge.textContent = total;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (e) {
        console.error('Failed to update badge:', e);
    }
}

// ============================================================================
// DASHBOARD
// ============================================================================

async function renderDashboard() {
    const app = document.getElementById('app');
    try {
        const [stats, companies, sites, valuations] = await Promise.all([
            API.getStats(),
            API.getCompanies(),
            API.getSites(),
            API.getAllValuations()
        ]);

        // Calculate totals
        const totalBtc = companies.reduce((s, c) => s + (c.btc_holdings || 0), 0);
        const totalHashRate = companies.reduce((s, c) => s + (c.hash_rate_eh || 0), 0);
        const totalValuation = valuations.reduce((s, v) => s + v.totalValuation, 0);
        const totalMarketCap = valuations.reduce((s, v) => s + v.marketCap, 0);

        app.innerHTML = `
            <div class="flex items-center justify-between mb-6">
                <h1 class="text-2xl font-bold">Dashboard</h1>
                <div class="text-sm text-gray-400">
                    Press <kbd class="kbd">?</kbd> for keyboard shortcuts
                </div>
            </div>

            <!-- Key metrics -->
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                <div class="stat-card cursor-pointer hover:border-orange-500" onclick="navigate('companies')">
                    <div class="stat-value">${stats.companies}</div>
                    <div class="stat-label">Companies</div>
                </div>
                <div class="stat-card cursor-pointer hover:border-orange-500" onclick="navigate('sites')">
                    <div class="stat-value">${stats.sites}</div>
                    <div class="stat-label">Sites</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Format.mw(stats.totalMwEnergized)}</div>
                    <div class="stat-label">MW Energized</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Format.mw(stats.totalMwCapacity)}</div>
                    <div class="stat-label">MW Capacity</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Format.eh(totalHashRate)}</div>
                    <div class="stat-label">Total Hash Rate</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Format.btc(totalBtc)}</div>
                    <div class="stat-label">Total BTC</div>
                </div>
            </div>

            <!-- Valuation summary -->
            <div class="grid md:grid-cols-3 gap-4 mb-6">
                <div class="stat-card cursor-pointer hover:border-orange-500" onclick="navigate('valuation')">
                    <div class="stat-value text-orange-400">${Format.currency(totalValuation)}</div>
                    <div class="stat-label">Total Valuation</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Format.currency(totalMarketCap)}</div>
                    <div class="stat-label">Total Market Cap</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value ${totalValuation - totalMarketCap > 0 ? 'val-positive' : 'val-negative'}">
                        ${totalValuation - totalMarketCap > 0 ? '+' : ''}${Format.currency(totalValuation - totalMarketCap)}
                    </div>
                    <div class="stat-label">Valuation Difference</div>
                </div>
            </div>

            <!-- Charts row 1 -->
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <div class="card">
                    <div class="card-header">Sites by Status</div>
                    <div class="h-48">
                        <canvas id="chart-status"></canvas>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">Sites by State</div>
                    <div class="h-48">
                        <canvas id="chart-state"></canvas>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">Valuation vs Market Cap</div>
                    <div class="h-48">
                        <canvas id="chart-valuation"></canvas>
                    </div>
                </div>
            </div>

            <!-- Charts row 2 -->
            <div class="grid md:grid-cols-2 gap-6 mb-6">
                <div class="card">
                    <div class="card-header">MW Capacity by Company</div>
                    <div class="h-64">
                        <canvas id="chart-capacity"></canvas>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">BTC Holdings by Company</div>
                    <div class="h-64">
                        <canvas id="chart-btc"></canvas>
                    </div>
                </div>
            </div>

            <!-- Power cost distribution -->
            ${sites.filter(s => s.power_cost_kwh).length > 0 ? `
                <div class="card mb-6">
                    <div class="card-header">Power Costs by Site ($/kWh)</div>
                    <div class="h-48">
                        <canvas id="chart-power"></canvas>
                    </div>
                </div>
            ` : ''}

            <!-- Pending items alert -->
            ${stats.pendingNews + stats.pendingReview > 0 ? `
                <div class="card bg-yellow-900/20 border-yellow-700">
                    <div class="flex items-center justify-between">
                        <div>
                            <span class="font-medium">${stats.pendingNews + stats.pendingReview} items pending review</span>
                            <span class="text-gray-400 ml-2">(${stats.pendingNews} news, ${stats.pendingReview} data changes)</span>
                        </div>
                        <button onclick="navigate('review')" class="btn btn-primary btn-sm">Review Now</button>
                    </div>
                </div>
            ` : ''}

            <!-- Quick actions -->
            <div class="card mt-6">
                <div class="card-header">Quick Actions</div>
                <div class="flex flex-wrap gap-2">
                    <button onclick="showCompanyForm()" class="btn btn-secondary btn-sm">+ Add Company</button>
                    <button onclick="showSiteForm()" class="btn btn-secondary btn-sm">+ Add Site</button>
                    <button onclick="showNewsForm()" class="btn btn-secondary btn-sm">+ Add News</button>
                    <button onclick="showImportModal()" class="btn btn-secondary btn-sm">Import CSV</button>
                    <button onclick="exportData('all')" class="btn btn-secondary btn-sm">Export All</button>
                </div>
            </div>
        `;

        // Render charts after DOM is ready
        setTimeout(() => {
            if (stats.sitesByStatus.length) {
                Charts.createStatusChart('chart-status', stats.sitesByStatus);
            }
            if (stats.sitesByState.length) {
                Charts.createStateChart('chart-state', stats.sitesByState);
            }
            if (valuations.length) {
                Charts.createValuationChart('chart-valuation', valuations);
            }
            if (companies.length) {
                Charts.createCapacityChart('chart-capacity', companies);
                Charts.createBtcHoldingsChart('chart-btc', companies);
            }
            if (sites.filter(s => s.power_cost_kwh).length > 0) {
                Charts.createPowerCostChart('chart-power', sites);
            }
        }, 100);

    } catch (e) {
        app.innerHTML = `<div class="text-red-400">Error loading dashboard: ${e.message}</div>`;
    }
}

// ============================================================================
// COMPANIES
// ============================================================================

async function renderCompanies() {
    const app = document.getElementById('app');
    try {
        const companies = await API.getCompanies();

        app.innerHTML = `
            <div class="flex items-center justify-between mb-6">
                <h1 class="text-2xl font-bold">Companies</h1>
                <button onclick="showCompanyForm()" class="btn btn-primary">+ Add Company</button>
            </div>

            ${companies.length ? `
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th>Ticker</th>
                                <th>Sites</th>
                                <th>MW Energized</th>
                                <th>MW Capacity</th>
                                <th>Hash Rate</th>
                                <th>BTC Holdings</th>
                                <th>Market Cap</th>
                                <th class="actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${companies.map(c => `
                                <tr class="clickable-row" onclick="navigate('company', {id: ${c.id}})">
                                    <td class="font-medium">${c.name}</td>
                                    <td>${c.ticker || '-'}</td>
                                    <td>${c.site_count}</td>
                                    <td>${Format.mw(c.total_mw_energized)}</td>
                                    <td>${Format.mw(c.total_mw_capacity)}</td>
                                    <td>${Format.eh(c.hash_rate_eh)}</td>
                                    <td>${Format.btc(c.btc_holdings)}</td>
                                    <td>${Format.currency(c.market_cap_usd)}</td>
                                    <td class="actions" onclick="event.stopPropagation()">
                                        <button onclick="showCompanyForm(${c.id})" class="btn btn-secondary btn-sm">Edit</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : `
                <div class="empty-state">
                    <p>No companies yet.</p>
                    <button onclick="showCompanyForm()" class="btn btn-primary mt-4">Add First Company</button>
                </div>
            `}
        `;
    } catch (e) {
        app.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
    }
}

async function renderCompanyDetail(id) {
    const app = document.getElementById('app');
    try {
        const company = await API.getCompany(id);

        app.innerHTML = `
            <div class="breadcrumb">
                <a href="#" onclick="navigate('companies')">Companies</a>
                <span class="separator">/</span>
                <span class="text-white">${company.name}</span>
            </div>

            <div class="flex items-center justify-between mb-6">
                <h1 class="text-2xl font-bold">${company.name} ${company.ticker ? `(${company.ticker})` : ''}</h1>
                <div class="space-x-2">
                    <button onclick="showCompanyForm(${id})" class="btn btn-secondary">Edit</button>
                    <button onclick="showSiteForm(null, ${id})" class="btn btn-primary">+ Add Site</button>
                </div>
            </div>

            <div class="grid md:grid-cols-4 gap-4 mb-6">
                <div class="stat-card">
                    <div class="stat-value">${Format.eh(company.hash_rate_eh)}</div>
                    <div class="stat-label">Hash Rate</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Format.btc(company.btc_holdings)}</div>
                    <div class="stat-label">BTC Holdings</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Format.currency(company.market_cap_usd)}</div>
                    <div class="stat-label">Market Cap</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Format.currency(company.debt_usd)}</div>
                    <div class="stat-label">Debt</div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">Sites (${company.sites.length})</div>
                ${company.sites.length ? `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Site</th>
                                <th>Location</th>
                                <th>Status</th>
                                <th>MW Energized</th>
                                <th>MW Capacity</th>
                                <th>Power Cost</th>
                                <th class="actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${company.sites.map(s => `
                                <tr class="clickable-row" onclick="navigate('site', {id: ${s.id}})">
                                    <td class="font-medium">${s.name}</td>
                                    <td>${[s.city, s.state].filter(Boolean).join(', ') || '-'}</td>
                                    <td><span class="badge badge-${s.status}">${Format.status(s.status)}</span></td>
                                    <td>${Format.mw(s.total_mw_energized)}</td>
                                    <td>${Format.mw(s.total_mw_capacity)}</td>
                                    <td>${s.power_cost_kwh ? '$' + s.power_cost_kwh + '/kWh' : '-'}</td>
                                    <td class="actions" onclick="event.stopPropagation()">
                                        <button onclick="showSiteForm(${s.id})" class="btn btn-secondary btn-sm">Edit</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<div class="empty-state">No sites yet</div>'}
            </div>

            ${company.notes ? `
                <div class="card mt-4">
                    <div class="card-header">Notes</div>
                    <p class="text-gray-300">${company.notes}</p>
                </div>
            ` : ''}
        `;
    } catch (e) {
        app.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
    }
}

function showCompanyForm(id = null) {
    const isEdit = id !== null;
    const company = isEdit ? companiesCache.find(c => c.id === id) : {};

    showModal(`
        <div class="modal-header">
            <h2 class="modal-title">${isEdit ? 'Edit' : 'Add'} Company</h2>
            <button onclick="closeModal()" class="modal-close">&times;</button>
        </div>
        <form onsubmit="saveCompany(event, ${id})" class="modal-body">
            <div class="grid md:grid-cols-2 gap-4">
                <div class="form-group">
                    <label class="form-label">Company Name *</label>
                    <input type="text" name="name" class="form-input" value="${company.name || ''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Ticker</label>
                    <input type="text" name="ticker" class="form-input" value="${company.ticker || ''}" placeholder="e.g., MARA">
                </div>
                <div class="form-group">
                    <label class="form-label">Website</label>
                    <input type="url" name="website" class="form-input" value="${company.website || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">BTC Holdings</label>
                    <input type="number" step="0.01" name="btc_holdings" class="form-input" value="${company.btc_holdings || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Hash Rate (EH/s)</label>
                    <input type="number" step="0.01" name="hash_rate_eh" class="form-input" value="${company.hash_rate_eh || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Market Cap (USD)</label>
                    <input type="number" name="market_cap_usd" class="form-input" value="${company.market_cap_usd || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Debt (USD)</label>
                    <input type="number" name="debt_usd" class="form-input" value="${company.debt_usd || ''}">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea name="notes" class="form-textarea">${company.notes || ''}</textarea>
            </div>
            <div class="modal-footer">
                ${isEdit ? `<button type="button" onclick="deleteCompany(${id})" class="btn btn-danger">Delete</button>` : ''}
                <button type="button" onclick="closeModal()" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
    `);
}

async function saveCompany(e, id) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));

    // Convert numeric fields
    ['btc_holdings', 'hash_rate_eh', 'market_cap_usd', 'debt_usd'].forEach(f => {
        data[f] = data[f] ? parseFloat(data[f]) : null;
    });

    try {
        if (id) {
            await API.updateCompany(id, data);
            toast('Company updated', 'success');
        } else {
            await API.createCompany(data);
            toast('Company created', 'success');
        }
        closeModal();
        await loadCompaniesCache();
        navigate(currentPage === 'company' ? 'company' : 'companies', { id });
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function deleteCompany(id) {
    if (!confirm('Delete this company and all its sites?')) return;
    try {
        await API.deleteCompany(id);
        toast('Company deleted', 'success');
        closeModal();
        await loadCompaniesCache();
        navigate('companies');
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ============================================================================
// SITES
// ============================================================================

async function renderSites() {
    const app = document.getElementById('app');
    try {
        const sites = await API.getSites();
        const states = [...new Set(sites.map(s => s.state).filter(Boolean))].sort();

        app.innerHTML = `
            <div class="flex items-center justify-between mb-6">
                <h1 class="text-2xl font-bold">Sites</h1>
                <button onclick="showSiteForm()" class="btn btn-primary">+ Add Site</button>
            </div>

            <div class="filter-bar">
                <select id="filter-state" onchange="filterSites()" class="filter-input">
                    <option value="">All States</option>
                    ${states.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
                <select id="filter-status" onchange="filterSites()" class="filter-input">
                    <option value="">All Statuses</option>
                    <option value="operational">Operational</option>
                    <option value="under_construction">Under Construction</option>
                    <option value="planned">Planned</option>
                    <option value="curtailed">Curtailed</option>
                    <option value="closed">Closed</option>
                </select>
                <input type="number" id="filter-mw" placeholder="Min MW" onchange="filterSites()" class="filter-input w-24">
                <button onclick="exportData('sites')" class="btn btn-secondary btn-sm ml-auto">Export CSV</button>
            </div>

            <div id="sites-table" class="table-wrapper">
                ${renderSitesTable(sites)}
            </div>
        `;
    } catch (e) {
        app.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
    }
}

function renderSitesTable(sites) {
    if (!sites.length) {
        return '<div class="empty-state">No sites match your filters</div>';
    }
    return `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Site</th>
                    <th>Company</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>MW Energized</th>
                    <th>MW Capacity</th>
                    <th>Power Cost</th>
                    <th class="actions">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${sites.map(s => `
                    <tr class="clickable-row" onclick="navigate('site', {id: ${s.id}})">
                        <td class="font-medium">${s.name}</td>
                        <td>${s.company_name}</td>
                        <td>${[s.city, s.state].filter(Boolean).join(', ') || '-'}</td>
                        <td><span class="badge badge-${s.status}">${Format.status(s.status)}</span></td>
                        <td>${Format.mw(s.total_mw_energized)}</td>
                        <td>${Format.mw(s.total_mw_capacity)}</td>
                        <td>${s.power_cost_kwh ? '$' + s.power_cost_kwh + '/kWh' : '-'}</td>
                        <td class="actions" onclick="event.stopPropagation()">
                            <button onclick="showSiteForm(${s.id})" class="btn btn-secondary btn-sm">Edit</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function filterSites() {
    const state = document.getElementById('filter-state').value;
    const status = document.getElementById('filter-status').value;
    const minMw = document.getElementById('filter-mw').value;

    const params = {};
    if (state) params.state = state;
    if (status) params.status = status;
    if (minMw) params.min_mw = minMw;

    const sites = await API.getSites(params);
    document.getElementById('sites-table').innerHTML = renderSitesTable(sites);
}

async function renderSiteDetail(id) {
    const app = document.getElementById('app');
    try {
        const site = await API.getSite(id);

        app.innerHTML = `
            <div class="breadcrumb">
                <a href="#" onclick="navigate('companies')">Companies</a>
                <span class="separator">/</span>
                <a href="#" onclick="navigate('company', {id: ${site.company_id}})">${site.company_name}</a>
                <span class="separator">/</span>
                <span class="text-white">${site.name}</span>
            </div>

            <div class="flex items-center justify-between mb-6">
                <div>
                    <h1 class="text-2xl font-bold">${site.name}</h1>
                    <p class="text-gray-400">${[site.city, site.state, site.country].filter(Boolean).join(', ')}</p>
                </div>
                <div class="space-x-2">
                    <button onclick="showSiteForm(${id})" class="btn btn-secondary">Edit</button>
                    <button onclick="showSubsiteForm(null, ${id})" class="btn btn-primary">+ Add Phase/Building</button>
                </div>
            </div>

            <div class="grid md:grid-cols-4 gap-4 mb-6">
                <div class="stat-card">
                    <div class="stat-value"><span class="badge badge-${site.status}">${Format.status(site.status)}</span></div>
                    <div class="stat-label">Status</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Format.mw(site.total_mw_capacity)}</div>
                    <div class="stat-label">Total Capacity</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${site.power_cost_kwh ? '$' + site.power_cost_kwh + '/kWh' : '-'}</div>
                    <div class="stat-label">Power Cost</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${site.utility_provider || '-'}</div>
                    <div class="stat-label">Utility</div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-header">Phases / Buildings (${site.subsites.length})</div>
                ${site.subsites.length ? `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Status</th>
                                <th>MW Contracted</th>
                                <th>MW Energized</th>
                                <th>Hash Rate</th>
                                <th>Energization Date</th>
                                <th class="actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${site.subsites.map(sub => `
                                <tr class="clickable-row" onclick="navigate('subsite', {id: ${sub.id}})">
                                    <td class="font-medium">${sub.name}</td>
                                    <td><span class="badge badge-${sub.status}">${Format.status(sub.status)}</span></td>
                                    <td>${Format.mw(sub.mw_contracted)}</td>
                                    <td>${Format.mw(sub.mw_energized)}</td>
                                    <td>${Format.eh(sub.hash_rate_eh)}</td>
                                    <td>${Format.date(sub.energization_date)}</td>
                                    <td class="actions" onclick="event.stopPropagation()">
                                        <button onclick="showSubsiteForm(${sub.id})" class="btn btn-secondary btn-sm">Edit</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<div class="empty-state">No phases/buildings yet</div>'}
            </div>

            ${site.notes || site.ppa_term_years || site.land_acres ? `
                <div class="card">
                    <div class="card-header">Details</div>
                    <div class="grid md:grid-cols-3 gap-4 text-sm">
                        ${site.land_acres ? `<div><span class="text-gray-400">Land:</span> ${site.land_acres} acres</div>` : ''}
                        ${site.ppa_term_years ? `<div><span class="text-gray-400">PPA Term:</span> ${site.ppa_term_years} years</div>` : ''}
                        ${site.power_source ? `<div><span class="text-gray-400">Power Source:</span> ${site.power_source}</div>` : ''}
                    </div>
                    ${site.notes ? `<p class="mt-4 text-gray-300">${site.notes}</p>` : ''}
                </div>
            ` : ''}
        `;
    } catch (e) {
        app.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
    }
}

async function showSiteForm(id = null, companyId = null) {
    let site = {};
    if (id) {
        site = await API.getSite(id);
        companyId = site.company_id;
    }

    showModal(`
        <div class="modal-header">
            <h2 class="modal-title">${id ? 'Edit' : 'Add'} Site</h2>
            <button onclick="closeModal()" class="modal-close">&times;</button>
        </div>
        <form onsubmit="saveSite(event, ${id})" class="modal-body">
            <div class="grid md:grid-cols-2 gap-4">
                <div class="form-group">
                    <label class="form-label">Company *</label>
                    <select name="company_id" class="form-select" required>
                        <option value="">Select company...</option>
                        ${companiesCache.map(c => `
                            <option value="${c.id}" ${c.id === companyId ? 'selected' : ''}>${c.name}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Site Name *</label>
                    <input type="text" name="name" class="form-input" value="${site.name || ''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">City</label>
                    <input type="text" name="city" class="form-input" value="${site.city || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">State</label>
                    <input type="text" name="state" class="form-input" value="${site.state || ''}" placeholder="e.g., TX">
                </div>
                <div class="form-group">
                    <label class="form-label">Country</label>
                    <input type="text" name="country" class="form-input" value="${site.country || 'USA'}">
                </div>
                <div class="form-group">
                    <label class="form-label">Status</label>
                    <select name="status" class="form-select">
                        <option value="planned" ${site.status === 'planned' ? 'selected' : ''}>Planned</option>
                        <option value="under_construction" ${site.status === 'under_construction' ? 'selected' : ''}>Under Construction</option>
                        <option value="operational" ${site.status === 'operational' ? 'selected' : ''}>Operational</option>
                        <option value="curtailed" ${site.status === 'curtailed' ? 'selected' : ''}>Curtailed</option>
                        <option value="closed" ${site.status === 'closed' ? 'selected' : ''}>Closed</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Total MW Capacity</label>
                    <input type="number" step="0.1" name="total_mw_capacity" class="form-input" value="${site.total_mw_capacity || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Land (acres)</label>
                    <input type="number" step="0.1" name="land_acres" class="form-input" value="${site.land_acres || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Utility Provider</label>
                    <input type="text" name="utility_provider" class="form-input" value="${site.utility_provider || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Power Cost ($/kWh)</label>
                    <input type="number" step="0.001" name="power_cost_kwh" class="form-input" value="${site.power_cost_kwh || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">PPA Term (years)</label>
                    <input type="number" step="0.5" name="ppa_term_years" class="form-input" value="${site.ppa_term_years || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Power Source</label>
                    <input type="text" name="power_source" class="form-input" value="${site.power_source || ''}" placeholder="e.g., Grid, Solar, Wind">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Address</label>
                <input type="text" name="address" class="form-input" value="${site.address || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea name="notes" class="form-textarea">${site.notes || ''}</textarea>
            </div>
            <div class="modal-footer">
                ${id ? `<button type="button" onclick="deleteSite(${id})" class="btn btn-danger">Delete</button>` : ''}
                <button type="button" onclick="closeModal()" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
    `);
}

async function saveSite(e, id) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));

    // Convert numeric fields
    ['company_id', 'total_mw_capacity', 'land_acres', 'power_cost_kwh', 'ppa_term_years'].forEach(f => {
        data[f] = data[f] ? parseFloat(data[f]) : null;
    });

    try {
        if (id) {
            await API.updateSite(id, data);
            toast('Site updated', 'success');
        } else {
            await API.createSite(data);
            toast('Site created', 'success');
        }
        closeModal();
        navigate(currentPage === 'site' ? 'site' : 'sites', { id });
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function deleteSite(id) {
    if (!confirm('Delete this site and all its phases?')) return;
    try {
        await API.deleteSite(id);
        toast('Site deleted', 'success');
        closeModal();
        navigate('sites');
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ============================================================================
// SUBSITES
// ============================================================================

async function renderSubsiteDetail(id) {
    const app = document.getElementById('app');
    try {
        const subsite = await API.getSubsite(id);

        app.innerHTML = `
            <div class="breadcrumb">
                <a href="#" onclick="navigate('companies')">Companies</a>
                <span class="separator">/</span>
                <a href="#" onclick="navigate('company', {id: ${subsite.company_id}})">${subsite.company_name}</a>
                <span class="separator">/</span>
                <a href="#" onclick="navigate('site', {id: ${subsite.site_id}})">${subsite.site_name}</a>
                <span class="separator">/</span>
                <span class="text-white">${subsite.name}</span>
            </div>

            <div class="flex items-center justify-between mb-6">
                <h1 class="text-2xl font-bold">${subsite.name}</h1>
                <div class="space-x-2">
                    <button onclick="showSubsiteForm(${id})" class="btn btn-secondary">Edit</button>
                    <button onclick="showHardwareForm(null, ${id})" class="btn btn-primary">+ Add Hardware</button>
                </div>
            </div>

            <div class="grid md:grid-cols-4 gap-4 mb-6">
                <div class="stat-card">
                    <div class="stat-value"><span class="badge badge-${subsite.status}">${Format.status(subsite.status)}</span></div>
                    <div class="stat-label">Status</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Format.mw(subsite.mw_contracted)}</div>
                    <div class="stat-label">MW Contracted</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Format.mw(subsite.mw_energized)}</div>
                    <div class="stat-label">MW Energized</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Format.eh(subsite.hash_rate_eh)}</div>
                    <div class="stat-label">Hash Rate</div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">Hardware Deployed (${subsite.hardware.length})</div>
                ${subsite.hardware.length ? `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Model</th>
                                <th>Manufacturer</th>
                                <th>Quantity</th>
                                <th>TH/s Each</th>
                                <th>Watts Each</th>
                                <th>Status</th>
                                <th class="actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${subsite.hardware.map(h => `
                                <tr>
                                    <td class="font-medium">${h.model}</td>
                                    <td>${h.manufacturer || '-'}</td>
                                    <td>${Format.number(h.quantity)}</td>
                                    <td>${h.hash_rate_th_each || '-'}</td>
                                    <td>${h.power_watts_each || '-'}</td>
                                    <td><span class="badge badge-${h.status === 'deployed' ? 'operational' : h.status}">${Format.status(h.status)}</span></td>
                                    <td class="actions">
                                        <button onclick="showHardwareForm(${h.id}, ${id})" class="btn btn-secondary btn-sm">Edit</button>
                                        <button onclick="deleteHardware(${h.id})" class="btn btn-danger btn-sm">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<div class="empty-state">No hardware deployed yet</div>'}
            </div>

            ${subsite.energization_date || subsite.notes ? `
                <div class="card mt-4">
                    <div class="card-header">Details</div>
                    ${subsite.energization_date ? `<p class="text-gray-300 mb-2"><span class="text-gray-400">Energization Date:</span> ${Format.date(subsite.energization_date)}</p>` : ''}
                    ${subsite.notes ? `<p class="text-gray-300">${subsite.notes}</p>` : ''}
                </div>
            ` : ''}
        `;
    } catch (e) {
        app.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
    }
}

async function showSubsiteForm(id = null, siteId = null) {
    let subsite = {};
    if (id) {
        subsite = await API.getSubsite(id);
        siteId = subsite.site_id;
    }

    showModal(`
        <div class="modal-header">
            <h2 class="modal-title">${id ? 'Edit' : 'Add'} Phase/Building</h2>
            <button onclick="closeModal()" class="modal-close">&times;</button>
        </div>
        <form onsubmit="saveSubsite(event, ${id}, ${siteId})" class="modal-body">
            <input type="hidden" name="site_id" value="${siteId}">
            <div class="grid md:grid-cols-2 gap-4">
                <div class="form-group">
                    <label class="form-label">Name *</label>
                    <input type="text" name="name" class="form-input" value="${subsite.name || ''}" required placeholder="e.g., Phase 1, Building A">
                </div>
                <div class="form-group">
                    <label class="form-label">Status</label>
                    <select name="status" class="form-select">
                        <option value="planned" ${subsite.status === 'planned' ? 'selected' : ''}>Planned</option>
                        <option value="under_construction" ${subsite.status === 'under_construction' ? 'selected' : ''}>Under Construction</option>
                        <option value="operational" ${subsite.status === 'operational' ? 'selected' : ''}>Operational</option>
                        <option value="curtailed" ${subsite.status === 'curtailed' ? 'selected' : ''}>Curtailed</option>
                        <option value="closed" ${subsite.status === 'closed' ? 'selected' : ''}>Closed</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">MW Contracted</label>
                    <input type="number" step="0.1" name="mw_contracted" class="form-input" value="${subsite.mw_contracted || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">MW Energized</label>
                    <input type="number" step="0.1" name="mw_energized" class="form-input" value="${subsite.mw_energized || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Hash Rate (EH/s)</label>
                    <input type="number" step="0.01" name="hash_rate_eh" class="form-input" value="${subsite.hash_rate_eh || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Energization Date</label>
                    <input type="date" name="energization_date" class="form-input" value="${subsite.energization_date || ''}">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea name="notes" class="form-textarea">${subsite.notes || ''}</textarea>
            </div>
            <div class="modal-footer">
                ${id ? `<button type="button" onclick="deleteSubsite(${id})" class="btn btn-danger">Delete</button>` : ''}
                <button type="button" onclick="closeModal()" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
    `);
}

async function saveSubsite(e, id, siteId) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));

    ['site_id', 'mw_contracted', 'mw_energized', 'hash_rate_eh'].forEach(f => {
        data[f] = data[f] ? parseFloat(data[f]) : null;
    });

    try {
        if (id) {
            await API.updateSubsite(id, data);
            toast('Phase updated', 'success');
        } else {
            await API.createSubsite(data);
            toast('Phase created', 'success');
        }
        closeModal();
        navigate(currentPage === 'subsite' ? 'subsite' : 'site', { id: currentPage === 'subsite' ? id : siteId });
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function deleteSubsite(id) {
    if (!confirm('Delete this phase and all its hardware?')) return;
    try {
        const subsite = await API.getSubsite(id);
        await API.deleteSubsite(id);
        toast('Phase deleted', 'success');
        closeModal();
        navigate('site', { id: subsite.site_id });
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ============================================================================
// HARDWARE
// ============================================================================

async function showHardwareForm(id = null, subsiteId = null) {
    let hardware = {};
    if (id) {
        const allHardware = await API.getHardware({ subsite_id: subsiteId });
        hardware = allHardware.find(h => h.id === id) || {};
    }

    showModal(`
        <div class="modal-header">
            <h2 class="modal-title">${id ? 'Edit' : 'Add'} Hardware</h2>
            <button onclick="closeModal()" class="modal-close">&times;</button>
        </div>
        <form onsubmit="saveHardware(event, ${id}, ${subsiteId})" class="modal-body">
            <input type="hidden" name="subsite_id" value="${subsiteId}">
            <div class="grid md:grid-cols-2 gap-4">
                <div class="form-group">
                    <label class="form-label">Model *</label>
                    <input type="text" name="model" class="form-input" value="${hardware.model || ''}" required placeholder="e.g., Antminer S19 XP">
                </div>
                <div class="form-group">
                    <label class="form-label">Manufacturer</label>
                    <input type="text" name="manufacturer" class="form-input" value="${hardware.manufacturer || ''}" placeholder="e.g., Bitmain">
                </div>
                <div class="form-group">
                    <label class="form-label">Quantity</label>
                    <input type="number" name="quantity" class="form-input" value="${hardware.quantity || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">TH/s per Unit</label>
                    <input type="number" step="0.1" name="hash_rate_th_each" class="form-input" value="${hardware.hash_rate_th_each || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Watts per Unit</label>
                    <input type="number" name="power_watts_each" class="form-input" value="${hardware.power_watts_each || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Status</label>
                    <select name="status" class="form-select">
                        <option value="ordered" ${hardware.status === 'ordered' ? 'selected' : ''}>Ordered</option>
                        <option value="delivered" ${hardware.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="deployed" ${hardware.status === 'deployed' ? 'selected' : ''}>Deployed</option>
                        <option value="offline" ${hardware.status === 'offline' ? 'selected' : ''}>Offline</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Deployment Date</label>
                    <input type="date" name="deployment_date" class="form-input" value="${hardware.deployment_date || ''}">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea name="notes" class="form-textarea">${hardware.notes || ''}</textarea>
            </div>
            <div class="modal-footer">
                <button type="button" onclick="closeModal()" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
    `);
}

async function saveHardware(e, id, subsiteId) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));

    ['subsite_id', 'quantity', 'hash_rate_th_each', 'power_watts_each'].forEach(f => {
        data[f] = data[f] ? parseFloat(data[f]) : null;
    });

    try {
        if (id) {
            await API.updateHardware(id, data);
            toast('Hardware updated', 'success');
        } else {
            await API.createHardware(data);
            toast('Hardware added', 'success');
        }
        closeModal();
        navigate('subsite', { id: subsiteId });
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function deleteHardware(id) {
    if (!confirm('Delete this hardware entry?')) return;
    try {
        await API.deleteHardware(id);
        toast('Hardware deleted', 'success');
        navigate('subsite', { id: currentPage === 'subsite' ? window.location.hash.split('id:')[1] : null });
        // Reload current page
        const match = window.location.hash.match(/id:\s*(\d+)/);
        if (match) navigate('subsite', { id: parseInt(match[1]) });
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ============================================================================
// NEWS
// ============================================================================

async function renderNews() {
    const app = document.getElementById('app');
    try {
        const news = await API.getNews();

        app.innerHTML = `
            <div class="flex items-center justify-between mb-6">
                <h1 class="text-2xl font-bold">News & Filings</h1>
                <button onclick="showNewsForm()" class="btn btn-primary">+ Add News</button>
            </div>

            <div class="filter-bar">
                <select id="news-filter-status" onchange="filterNews()" class="filter-input">
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>

            <div id="news-list">
                ${renderNewsList(news)}
            </div>
        `;
    } catch (e) {
        app.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
    }
}

function renderNewsList(news) {
    if (!news.length) {
        return '<div class="empty-state">No news items yet</div>';
    }
    return `
        <div class="space-y-4">
            ${news.map(n => `
                <div class="card">
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="badge badge-${n.status}">${Format.status(n.status)}</span>
                                ${n.company_name ? `<span class="text-sm text-gray-400">${n.company_name}</span>` : ''}
                                ${n.site_name ? `<span class="text-sm text-gray-400">/ ${n.site_name}</span>` : ''}
                            </div>
                            <h3 class="font-medium mb-1">${n.title}</h3>
                            <div class="text-sm text-gray-400">
                                ${n.source ? `<span>${n.source}</span>` : ''}
                                ${n.publish_date ? `<span> - ${Format.date(n.publish_date)}</span>` : ''}
                            </div>
                            ${n.summary ? `<p class="mt-2 text-gray-300 text-sm">${n.summary}</p>` : ''}
                        </div>
                        <div class="space-x-2 ml-4">
                            <button onclick="showNewsForm(${n.id})" class="btn btn-secondary btn-sm">Edit</button>
                            ${n.status === 'pending' ? `
                                <button onclick="approveNews(${n.id})" class="btn btn-success btn-sm">Approve</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function filterNews() {
    const status = document.getElementById('news-filter-status').value;
    const news = await API.getNews(status ? { status } : {});
    document.getElementById('news-list').innerHTML = renderNewsList(news);
}

async function showNewsForm(id = null) {
    let news = {};
    if (id) {
        news = await API.getNewsItem(id);
    }

    const sites = await API.getSites();

    showModal(`
        <div class="modal-header">
            <h2 class="modal-title">${id ? 'Edit' : 'Add'} News / Filing</h2>
            <button onclick="closeModal()" class="modal-close">&times;</button>
        </div>
        <form onsubmit="saveNews(event, ${id})" class="modal-body">
            <div class="grid md:grid-cols-2 gap-4">
                <div class="form-group">
                    <label class="form-label">Title *</label>
                    <input type="text" name="title" class="form-input" value="${news.title || ''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Source</label>
                    <input type="text" name="source" class="form-input" value="${news.source || ''}" placeholder="e.g., SEC 10-K, Bloomberg">
                </div>
                <div class="form-group">
                    <label class="form-label">Company</label>
                    <select name="company_id" class="form-select">
                        <option value="">None</option>
                        ${companiesCache.map(c => `
                            <option value="${c.id}" ${c.id === news.company_id ? 'selected' : ''}>${c.name}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Site</label>
                    <select name="site_id" class="form-select">
                        <option value="">None</option>
                        ${sites.map(s => `
                            <option value="${s.id}" ${s.id === news.site_id ? 'selected' : ''}>${s.company_name} - ${s.name}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">URL</label>
                    <input type="url" name="url" class="form-input" value="${news.url || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Publish Date</label>
                    <input type="date" name="publish_date" class="form-input" value="${news.publish_date || ''}">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Summary</label>
                <textarea name="summary" class="form-textarea" rows="2">${news.summary || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Full Content</label>
                <textarea name="content" class="form-textarea" rows="6">${news.content || ''}</textarea>
            </div>
            <div class="modal-footer">
                ${id ? `<button type="button" onclick="deleteNews(${id})" class="btn btn-danger">Delete</button>` : ''}
                <button type="button" onclick="closeModal()" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
    `);
}

async function saveNews(e, id) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));

    data.company_id = data.company_id ? parseInt(data.company_id) : null;
    data.site_id = data.site_id ? parseInt(data.site_id) : null;

    try {
        if (id) {
            await API.updateNews(id, data);
            toast('News updated', 'success');
        } else {
            await API.createNews(data);
            toast('News created', 'success');
        }
        closeModal();
        await updatePendingBadge();
        renderNews();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function approveNews(id) {
    try {
        await API.updateNews(id, { status: 'approved' });
        toast('News approved', 'success');
        await updatePendingBadge();
        renderNews();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function deleteNews(id) {
    if (!confirm('Delete this news item?')) return;
    try {
        await API.deleteNews(id);
        toast('News deleted', 'success');
        closeModal();
        await updatePendingBadge();
        renderNews();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ============================================================================
// REVIEW QUEUE
// ============================================================================

async function renderReviewQueue() {
    const app = document.getElementById('app');
    try {
        const items = await API.getReviewQueue({ status: 'pending' });
        const pendingNews = await API.getNews({ status: 'pending' });

        app.innerHTML = `
            <h1 class="text-2xl font-bold mb-6">Review Queue</h1>

            ${pendingNews.length ? `
                <div class="card mb-6">
                    <div class="card-header">Pending News (${pendingNews.length})</div>
                    <div class="space-y-3">
                        ${pendingNews.map(n => `
                            <div class="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                                <div>
                                    <div class="font-medium">${n.title}</div>
                                    <div class="text-sm text-gray-400">${n.company_name || 'No company'} - ${n.source || 'Unknown source'}</div>
                                </div>
                                <div class="space-x-2">
                                    <button onclick="showNewsForm(${n.id})" class="btn btn-secondary btn-sm">Review</button>
                                    <button onclick="approveNews(${n.id})" class="btn btn-success btn-sm">Approve</button>
                                    <button onclick="rejectNews(${n.id})" class="btn btn-danger btn-sm">Reject</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${items.length ? `
                <div class="card">
                    <div class="card-header">Pending Data Changes (${items.length})</div>
                    <div class="space-y-3">
                        ${items.map(item => `
                            <div class="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                                <div>
                                    <div class="font-medium">${item.entity_type}: ${item.entity_id ? 'Update' : 'New'}</div>
                                    <div class="text-sm text-gray-400">${item.source || 'Manual entry'}</div>
                                    <pre class="text-xs text-gray-500 mt-1">${JSON.stringify(JSON.parse(item.proposed_data), null, 2).substring(0, 200)}...</pre>
                                </div>
                                <div class="space-x-2">
                                    <button onclick="decideReview(${item.id}, 'approve')" class="btn btn-success btn-sm">Approve</button>
                                    <button onclick="decideReview(${item.id}, 'reject')" class="btn btn-danger btn-sm">Reject</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${!items.length && !pendingNews.length ? `
                <div class="empty-state">
                    <p>No items pending review!</p>
                </div>
            ` : ''}
        `;
    } catch (e) {
        app.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
    }
}

async function rejectNews(id) {
    try {
        await API.updateNews(id, { status: 'rejected' });
        toast('News rejected', 'success');
        await updatePendingBadge();
        renderReviewQueue();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function decideReview(id, action) {
    try {
        await API.decideReview(id, action);
        toast(`Item ${action}d`, 'success');
        await updatePendingBadge();
        renderReviewQueue();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ============================================================================
// VALUATION
// ============================================================================

async function renderValuation() {
    const app = document.getElementById('app');
    try {
        await Valuation.loadSettings();
        const [valuations, settings] = await Promise.all([
            API.getAllValuations(),
            API.getSettings()
        ]);

        const totalValuation = valuations.reduce((s, v) => s + v.totalValuation, 0);
        const totalMarketCap = valuations.reduce((s, v) => s + v.marketCap, 0);
        const totalDiff = totalValuation - totalMarketCap;

        // Sort valuations for ranking
        const byUpside = [...valuations].sort((a, b) => (b.ratio || 0) - (a.ratio || 0));

        app.innerHTML = `
            <div class="flex items-center justify-between mb-6">
                <h1 class="text-2xl font-bold">Valuation Comparison</h1>
                <div class="space-x-2">
                    <button onclick="exportData('companies', 'csv')" class="btn btn-secondary btn-sm">Export CSV</button>
                    <button onclick="navigate('settings')" class="btn btn-primary">Edit Assumptions</button>
                </div>
            </div>

            <!-- Summary stats -->
            <div class="grid md:grid-cols-4 gap-4 mb-6">
                <div class="stat-card">
                    <div class="stat-value text-orange-400">${Format.currency(totalValuation)}</div>
                    <div class="stat-label">Total Valuation</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Format.currency(totalMarketCap)}</div>
                    <div class="stat-label">Total Market Cap</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value ${totalDiff > 0 ? 'val-positive' : 'val-negative'}">
                        ${totalDiff > 0 ? '+' : ''}${Format.currency(totalDiff)}
                    </div>
                    <div class="stat-label">Total Difference</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value ${totalValuation / totalMarketCap > 1 ? 'val-positive' : 'val-negative'}">
                        ${((totalValuation / totalMarketCap) * 100).toFixed(0)}%
                    </div>
                    <div class="stat-label">Aggregate Val/MC</div>
                </div>
            </div>

            <!-- Current assumptions -->
            <div class="card mb-6">
                <div class="card-header">Current Assumptions</div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span class="text-gray-400">BTC Price:</span>
                        <span class="font-medium ml-1">$${Format.number(parseFloat(settings.settings.btc_price))}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">$/MW Energized:</span>
                        <span class="font-medium ml-1">$${Format.number(parseFloat(settings.settings.mw_value_energized) / 1e6)}M</span>
                    </div>
                    <div>
                        <span class="text-gray-400">$/MW Contracted:</span>
                        <span class="font-medium ml-1">$${Format.number(parseFloat(settings.settings.mw_value_contracted) / 1e6)}M</span>
                    </div>
                    <div>
                        <span class="text-gray-400">$/MW Planned:</span>
                        <span class="font-medium ml-1">$${Format.number(parseFloat(settings.settings.mw_value_planned) / 1e6)}M</span>
                    </div>
                </div>
            </div>

            <!-- Charts -->
            <div class="grid md:grid-cols-2 gap-6 mb-6">
                <div class="card">
                    <div class="card-header">Valuation vs Market Cap</div>
                    <div class="h-64">
                        <canvas id="val-chart-comparison"></canvas>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">Valuation Ratio (Val / MC)</div>
                    <div class="h-64">
                        <canvas id="val-chart-ratio"></canvas>
                    </div>
                </div>
            </div>

            <!-- Ranking cards -->
            <div class="grid md:grid-cols-3 gap-4 mb-6">
                <div class="card">
                    <div class="card-header text-green-400">Most Undervalued</div>
                    ${byUpside.filter(v => v.ratio > 1).slice(0, 3).map((v, i) => `
                        <div class="flex items-center justify-between py-2 ${i > 0 ? 'border-t border-gray-700' : ''} cursor-pointer hover:bg-gray-700 -mx-4 px-4" onclick="showCompanyValuation(${v.id})">
                            <span>${v.ticker || v.name}</span>
                            <span class="val-positive font-medium">${(v.ratio * 100).toFixed(0)}%</span>
                        </div>
                    `).join('') || '<div class="text-gray-400 text-sm">None currently</div>'}
                </div>
                <div class="card">
                    <div class="card-header text-red-400">Most Overvalued</div>
                    ${byUpside.filter(v => v.ratio < 1).slice(-3).reverse().map((v, i) => `
                        <div class="flex items-center justify-between py-2 ${i > 0 ? 'border-t border-gray-700' : ''} cursor-pointer hover:bg-gray-700 -mx-4 px-4" onclick="showCompanyValuation(${v.id})">
                            <span>${v.ticker || v.name}</span>
                            <span class="val-negative font-medium">${(v.ratio * 100).toFixed(0)}%</span>
                        </div>
                    `).join('') || '<div class="text-gray-400 text-sm">None currently</div>'}
                </div>
                <div class="card">
                    <div class="card-header text-yellow-400">Largest BTC Holdings</div>
                    ${[...valuations].sort((a, b) => (b.btcHoldings || 0) - (a.btcHoldings || 0)).slice(0, 3).map((v, i) => `
                        <div class="flex items-center justify-between py-2 ${i > 0 ? 'border-t border-gray-700' : ''} cursor-pointer hover:bg-gray-700 -mx-4 px-4" onclick="showCompanyValuation(${v.id})">
                            <span>${v.ticker || v.name}</span>
                            <span class="font-medium">${Format.btc(v.btcHoldings)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Detailed table -->
            ${valuations.length ? `
                <div class="card">
                    <div class="card-header">Detailed Comparison</div>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Company</th>
                                    <th>MW Energized</th>
                                    <th>Hash Rate</th>
                                    <th>BTC</th>
                                    <th>Site Value</th>
                                    <th>BTC Value</th>
                                    <th>Total Val</th>
                                    <th>Market Cap</th>
                                    <th>Diff</th>
                                    <th>Val/MC</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${valuations.map(v => `
                                    <tr class="clickable-row" onclick="showCompanyValuation(${v.id})">
                                        <td class="font-medium">${v.name} ${v.ticker ? `<span class="text-gray-400">(${v.ticker})</span>` : ''}</td>
                                        <td>${Format.mw(v.totalMwEnergized)}</td>
                                        <td>${Format.eh(v.hashRateEh)}</td>
                                        <td>${Format.btc(v.btcHoldings)}</td>
                                        <td>${Format.currency(v.siteValue)}</td>
                                        <td>${Format.currency(v.btcValue)}</td>
                                        <td class="font-medium">${Format.currency(v.totalValuation)}</td>
                                        <td>${Format.currency(v.marketCap)}</td>
                                        <td class="${v.diff > 0 ? 'val-positive' : 'val-negative'}">
                                            ${v.diff > 0 ? '+' : ''}${Format.currency(v.diff)}
                                        </td>
                                        <td>
                                            <div class="flex items-center">
                                                <span class="${v.ratio > 1 ? 'val-positive' : 'val-negative'} font-medium">
                                                    ${v.ratio ? (v.ratio * 100).toFixed(0) + '%' : '-'}
                                                </span>
                                                <div class="ml-2 w-16 h-2 bg-gray-700 rounded overflow-hidden">
                                                    <div class="h-full ${v.ratio > 1 ? 'bg-green-500' : 'bg-red-500'}"
                                                         style="width: ${Math.min(v.ratio * 50, 100)}%"></div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : '<div class="empty-state">Add companies and sites to see valuations</div>'}
        `;

        // Render charts
        setTimeout(() => {
            if (valuations.length) {
                Charts.createValuationChart('val-chart-comparison', valuations);

                // Custom ratio chart
                const ctx = document.getElementById('val-chart-ratio');
                if (ctx) {
                    Charts.destroy('val-chart-ratio');
                    Charts.instances['val-chart-ratio'] = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: valuations.map(v => v.ticker || v.name),
                            datasets: [{
                                label: 'Val/MC Ratio',
                                data: valuations.map(v => v.ratio ? v.ratio * 100 : 0),
                                backgroundColor: valuations.map(v => v.ratio > 1 ? Charts.colors.green : Charts.colors.red)
                            }]
                        },
                        options: {
                            ...Charts.darkThemeOptions,
                            scales: {
                                x: { ticks: { color: '#9ca3af' }, grid: { display: false } },
                                y: {
                                    ticks: { color: '#9ca3af', callback: v => v + '%' },
                                    grid: { color: '#374151' }
                                }
                            },
                            plugins: {
                                legend: { display: false },
                                annotation: {
                                    annotations: {
                                        line1: { type: 'line', yMin: 100, yMax: 100, borderColor: '#6b7280', borderDash: [5, 5] }
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }, 100);

    } catch (e) {
        app.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
    }
}

async function showCompanyValuation(id) {
    try {
        const data = await API.getCompanyValuation(id);

        showModal(`
            <div class="modal-header">
                <h2 class="modal-title">${data.company.name} - Valuation Detail</h2>
                <button onclick="closeModal()" class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="grid grid-cols-3 gap-4 mb-6">
                    <div class="stat-card">
                        <div class="stat-value">${Format.currency(data.valuation.total)}</div>
                        <div class="stat-label">Total Valuation</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${Format.currency(data.valuation.marketCap)}</div>
                        <div class="stat-label">Market Cap</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value ${data.valuation.diff > 0 ? 'val-positive' : 'val-negative'}">
                            ${data.valuation.diff > 0 ? '+' : ''}${Format.currency(data.valuation.diff)}
                        </div>
                        <div class="stat-label">Difference</div>
                    </div>
                </div>

                <h3 class="font-medium mb-3">Valuation Breakdown</h3>
                <div class="space-y-2 text-sm mb-6">
                    <div class="flex justify-between"><span>Site Value:</span> <span>${Format.currency(data.valuation.siteValue)}</span></div>
                    <div class="flex justify-between"><span>BTC Holdings (${Format.btc(data.company.btc_holdings)}):</span> <span>${Format.currency(data.valuation.btcValue)}</span></div>
                </div>

                <h3 class="font-medium mb-3">Site Valuations</h3>
                <div class="space-y-2">
                    ${data.sites.map(s => `
                        <div class="flex justify-between items-center py-2 border-b border-gray-700">
                            <div>
                                <span class="font-medium">${s.name}</span>
                                <span class="badge badge-${s.status} ml-2">${Format.status(s.status)}</span>
                            </div>
                            <span>${Format.currency(s.valuation)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `);
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ============================================================================
// SETTINGS
// ============================================================================

async function renderSettings() {
    const app = document.getElementById('app');
    try {
        const data = await API.getSettings();
        const settings = data.settingsDetails;
        const multipliers = data.multipliers;

        // Group settings by category
        const grouped = {};
        for (const s of settings) {
            const cat = s.category || 'other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(s);
        }

        const categoryTitles = {
            capacity: 'Capacity Valuations ($/MW)',
            hashrate: 'Hash Rate Valuation',
            bitcoin: 'Bitcoin Settings',
            discounts: 'Status Discount Rates',
            power: 'Power Cost Adjustments'
        };

        app.innerHTML = `
            <h1 class="text-2xl font-bold mb-6">Valuation Settings</h1>

            <div class="grid md:grid-cols-2 gap-6">
                ${Object.entries(grouped).map(([cat, items]) => `
                    <div class="card">
                        <div class="card-header">${categoryTitles[cat] || cat}</div>
                        <div class="space-y-3">
                            ${items.map(s => `
                                <div class="setting-row">
                                    <div>
                                        <div class="setting-label">${s.description || s.key}</div>
                                    </div>
                                    <input type="${s.key.includes('price') || s.key.includes('value') || s.key.includes('threshold') || s.key.includes('multiplier') || s.key.includes('discount') ? 'number' : 'text'}"
                                           step="any"
                                           class="setting-input"
                                           value="${s.value}"
                                           onchange="updateSetting('${s.key}', this.value)">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="card mt-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="card-header mb-0">Custom Multipliers</div>
                    <button onclick="showMultiplierForm()" class="btn btn-primary btn-sm">+ Add Multiplier</button>
                </div>
                ${multipliers.length ? `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Multiplier</th>
                                <th>Scope</th>
                                <th>Active</th>
                                <th class="actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${multipliers.map(m => `
                                <tr>
                                    <td class="font-medium">${m.name}</td>
                                    <td>${m.multiplier}x</td>
                                    <td>${m.scope}${m.scope_value ? `: ${m.scope_value}` : ''}</td>
                                    <td>${m.is_active ? 'Yes' : 'No'}</td>
                                    <td class="actions">
                                        <button onclick="showMultiplierForm(${m.id})" class="btn btn-secondary btn-sm">Edit</button>
                                        <button onclick="deleteMultiplier(${m.id})" class="btn btn-danger btn-sm">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<div class="empty-state">No custom multipliers defined</div>'}
            </div>
        `;
    } catch (e) {
        app.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
    }
}

async function updateSetting(key, value) {
    try {
        await API.updateSetting(key, value);
        toast('Setting saved', 'success');
        await Valuation.loadSettings();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function showMultiplierForm(id = null) {
    let multiplier = {};
    if (id) {
        const data = await API.getSettings();
        multiplier = data.multipliers.find(m => m.id === id) || {};
    }

    showModal(`
        <div class="modal-header">
            <h2 class="modal-title">${id ? 'Edit' : 'Add'} Custom Multiplier</h2>
            <button onclick="closeModal()" class="modal-close">&times;</button>
        </div>
        <form onsubmit="saveMultiplier(event, ${id})" class="modal-body">
            <div class="grid md:grid-cols-2 gap-4">
                <div class="form-group">
                    <label class="form-label">Name *</label>
                    <input type="text" name="name" class="form-input" value="${multiplier.name || ''}" required placeholder="e.g., Texas Grid Risk">
                </div>
                <div class="form-group">
                    <label class="form-label">Multiplier *</label>
                    <input type="number" step="0.01" name="multiplier" class="form-input" value="${multiplier.multiplier || 1.0}" required>
                    <p class="text-xs text-gray-400 mt-1">1.0 = no change, 0.9 = 10% discount, 1.1 = 10% premium</p>
                </div>
                <div class="form-group">
                    <label class="form-label">Scope</label>
                    <select name="scope" class="form-select">
                        <option value="global" ${multiplier.scope === 'global' ? 'selected' : ''}>Global (all sites)</option>
                        <option value="state" ${multiplier.scope === 'state' ? 'selected' : ''}>By State</option>
                        <option value="company" ${multiplier.scope === 'company' ? 'selected' : ''}>By Company</option>
                        <option value="site" ${multiplier.scope === 'site' ? 'selected' : ''}>By Site</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Scope Value</label>
                    <input type="text" name="scope_value" class="form-input" value="${multiplier.scope_value || ''}" placeholder="e.g., TX or company ID">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea name="description" class="form-textarea">${multiplier.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="flex items-center">
                    <input type="checkbox" name="is_active" ${multiplier.is_active !== 0 ? 'checked' : ''} class="mr-2">
                    Active
                </label>
            </div>
            <div class="modal-footer">
                <button type="button" onclick="closeModal()" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
    `);
}

async function saveMultiplier(e, id) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = {
        name: formData.get('name'),
        multiplier: parseFloat(formData.get('multiplier')),
        scope: formData.get('scope'),
        scope_value: formData.get('scope_value') || null,
        description: formData.get('description'),
        is_active: formData.has('is_active') ? 1 : 0
    };

    try {
        if (id) {
            await API.updateMultiplier(id, data);
            toast('Multiplier updated', 'success');
        } else {
            await API.createMultiplier(data);
            toast('Multiplier created', 'success');
        }
        closeModal();
        await Valuation.loadSettings();
        renderSettings();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function deleteMultiplier(id) {
    if (!confirm('Delete this multiplier?')) return;
    try {
        await API.deleteMultiplier(id);
        toast('Multiplier deleted', 'success');
        await Valuation.loadSettings();
        renderSettings();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ============================================================================
// UTILITIES
// ============================================================================

function showModal(content) {
    document.getElementById('modal-content').innerHTML = content;
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

// Close modal on backdrop click
document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

function toast(message, type = 'info') {
    const container = document.getElementById('toasts');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function exportData(type, format = 'json') {
    API.exportData(type, format);
}
