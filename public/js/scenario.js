// Scenario Modeling - What-if analysis

let baselineValuations = null;
let currentScenario = null;

// Add scenario to navigation
function addScenarioNav() {
    const nav = document.querySelector('.nav-btn[data-page="settings"]');
    if (nav && !document.querySelector('.nav-btn[data-page="scenario"]')) {
        const scenarioBtn = document.createElement('button');
        scenarioBtn.className = 'nav-btn';
        scenarioBtn.dataset.page = 'scenario';
        scenarioBtn.onclick = () => navigate('scenario');
        scenarioBtn.textContent = 'Scenarios';
        nav.parentNode.insertBefore(scenarioBtn, nav);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', addScenarioNav);

// Render scenario page
async function renderScenario() {
    const app = document.getElementById('app');

    try {
        // Load current settings and valuations
        const [settings, valuations, btcPrice] = await Promise.all([
            API.getSettings(),
            API.getAllValuations(),
            fetchBtcPrice()
        ]);

        baselineValuations = valuations;
        const s = settings.settings;

        app.innerHTML = `
            <div class="flex items-center justify-between mb-6">
                <h1 class="text-2xl font-bold">Scenario Modeling</h1>
                <div class="flex items-center space-x-2">
                    <span class="text-sm text-gray-400">Live BTC:</span>
                    <span class="text-orange-400 font-medium">$${Format.number(btcPrice.price)}</span>
                    ${btcPrice.source === 'coingecko' ? '<span class="text-green-400 text-xs">Live</span>' : '<span class="text-yellow-400 text-xs">Cached</span>'}
                    <button onclick="updateBtcPrice()" class="btn btn-secondary btn-sm">Refresh</button>
                </div>
            </div>

            <div class="grid md:grid-cols-3 gap-6">
                <!-- Scenario inputs -->
                <div class="card">
                    <div class="card-header">Scenario Parameters</div>

                    <div class="space-y-4">
                        <div>
                            <label class="form-label">BTC Price</label>
                            <div class="flex space-x-2">
                                <input type="number" id="scenario-btc" class="form-input" value="${s.btc_price}" onchange="runScenario()">
                                <button onclick="setScenarioField('scenario-btc', ${btcPrice.price})" class="btn btn-secondary btn-sm" title="Use live price">Live</button>
                            </div>
                        </div>

                        <div class="border-t border-gray-700 pt-4">
                            <div class="text-sm font-medium text-gray-300 mb-2">$/MW Valuations</div>
                            <div class="space-y-2">
                                <div class="flex items-center justify-between">
                                    <label class="text-sm text-gray-400">Energized</label>
                                    <input type="number" id="scenario-mw-energized" class="setting-input" value="${s.mw_value_energized}" onchange="runScenario()">
                                </div>
                                <div class="flex items-center justify-between">
                                    <label class="text-sm text-gray-400">Contracted</label>
                                    <input type="number" id="scenario-mw-contracted" class="setting-input" value="${s.mw_value_contracted}" onchange="runScenario()">
                                </div>
                                <div class="flex items-center justify-between">
                                    <label class="text-sm text-gray-400">Planned</label>
                                    <input type="number" id="scenario-mw-planned" class="setting-input" value="${s.mw_value_planned}" onchange="runScenario()">
                                </div>
                            </div>
                        </div>

                        <div class="border-t border-gray-700 pt-4">
                            <div class="text-sm font-medium text-gray-300 mb-2">Status Discounts</div>
                            <div class="space-y-2">
                                <div class="flex items-center justify-between">
                                    <label class="text-sm text-gray-400">Operational</label>
                                    <input type="number" step="0.1" id="scenario-discount-op" class="setting-input" value="${s.discount_operational}" onchange="runScenario()">
                                </div>
                                <div class="flex items-center justify-between">
                                    <label class="text-sm text-gray-400">Construction</label>
                                    <input type="number" step="0.1" id="scenario-discount-const" class="setting-input" value="${s.discount_under_construction}" onchange="runScenario()">
                                </div>
                                <div class="flex items-center justify-between">
                                    <label class="text-sm text-gray-400">Planned</label>
                                    <input type="number" step="0.1" id="scenario-discount-plan" class="setting-input" value="${s.discount_planned}" onchange="runScenario()">
                                </div>
                            </div>
                        </div>

                        <div class="border-t border-gray-700 pt-4 flex space-x-2">
                            <button onclick="resetScenario()" class="btn btn-secondary flex-1">Reset</button>
                            <button onclick="saveScenarioAsDefault()" class="btn btn-primary flex-1">Save as Default</button>
                        </div>
                    </div>
                </div>

                <!-- Results summary -->
                <div class="md:col-span-2 space-y-4">
                    <div class="grid grid-cols-3 gap-4">
                        <div class="stat-card">
                            <div class="stat-value text-orange-400" id="scenario-total-val">-</div>
                            <div class="stat-label">Scenario Valuation</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" id="scenario-total-mc">-</div>
                            <div class="stat-label">Market Cap</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" id="scenario-total-diff">-</div>
                            <div class="stat-label">Difference</div>
                        </div>
                    </div>

                    <!-- Comparison chart -->
                    <div class="card">
                        <div class="card-header">Scenario vs Baseline</div>
                        <div class="h-64">
                            <canvas id="scenario-chart"></canvas>
                        </div>
                    </div>

                    <!-- Per-company results -->
                    <div class="card">
                        <div class="card-header">Company Results</div>
                        <div class="table-wrapper">
                            <table class="data-table text-sm">
                                <thead>
                                    <tr>
                                        <th>Company</th>
                                        <th>Baseline Val</th>
                                        <th>Scenario Val</th>
                                        <th>Change</th>
                                        <th>Market Cap</th>
                                        <th>Scenario Diff</th>
                                    </tr>
                                </thead>
                                <tbody id="scenario-results">
                                    <!-- Filled dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Preset scenarios -->
            <div class="card mt-6">
                <div class="card-header">Quick Scenarios</div>
                <div class="flex flex-wrap gap-2">
                    <button onclick="applyPreset('bull')" class="btn btn-secondary btn-sm">Bull Case ($100K BTC)</button>
                    <button onclick="applyPreset('bear')" class="btn btn-secondary btn-sm">Bear Case ($40K BTC)</button>
                    <button onclick="applyPreset('premium')" class="btn btn-secondary btn-sm">Premium MW (+50%)</button>
                    <button onclick="applyPreset('discount')" class="btn btn-secondary btn-sm">Discount MW (-30%)</button>
                    <button onclick="applyPreset('aggressive')" class="btn btn-secondary btn-sm">Aggressive (low discounts)</button>
                    <button onclick="applyPreset('conservative')" class="btn btn-secondary btn-sm">Conservative (high discounts)</button>
                </div>
            </div>
        `;

        // Initial run
        runScenario();

    } catch (e) {
        app.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
    }
}

// Fetch live BTC price
async function fetchBtcPrice() {
    try {
        const resp = await fetch('/api/btc-price');
        return await resp.json();
    } catch (e) {
        return { price: 60000, source: 'error' };
    }
}

// Update BTC price and refresh
async function updateBtcPrice() {
    const resp = await fetch('/api/btc-price?update=true');
    const data = await resp.json();
    toast(`BTC price updated: $${Format.number(data.price)}`, 'success');
    navigate('scenario');
}

// Set a field value
function setScenarioField(fieldId, value) {
    document.getElementById(fieldId).value = value;
    runScenario();
}

// Run scenario calculation
async function runScenario() {
    const params = {
        btc_price: parseFloat(document.getElementById('scenario-btc').value),
        mw_value_energized: parseFloat(document.getElementById('scenario-mw-energized').value),
        mw_value_contracted: parseFloat(document.getElementById('scenario-mw-contracted').value),
        mw_value_planned: parseFloat(document.getElementById('scenario-mw-planned').value),
        discount_operational: parseFloat(document.getElementById('scenario-discount-op').value),
        discount_under_construction: parseFloat(document.getElementById('scenario-discount-const').value),
        discount_planned: parseFloat(document.getElementById('scenario-discount-plan').value)
    };

    try {
        const resp = await fetch('/api/scenario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        currentScenario = await resp.json();
        updateScenarioDisplay();
    } catch (e) {
        console.error('Scenario error:', e);
    }
}

// Update the display with scenario results
function updateScenarioDisplay() {
    if (!currentScenario || !baselineValuations) return;

    const { results, totals } = currentScenario;

    // Update summary stats
    document.getElementById('scenario-total-val').textContent = Format.currency(totals.valuation);
    document.getElementById('scenario-total-mc').textContent = Format.currency(totals.marketCap);

    const diffEl = document.getElementById('scenario-total-diff');
    diffEl.textContent = (totals.diff > 0 ? '+' : '') + Format.currency(totals.diff);
    diffEl.className = 'stat-value ' + (totals.diff > 0 ? 'val-positive' : 'val-negative');

    // Update table
    const tbody = document.getElementById('scenario-results');
    tbody.innerHTML = results.map(r => {
        const baseline = baselineValuations.find(b => b.id === r.id);
        const baselineVal = baseline?.totalValuation || 0;
        const change = r.totalValuation - baselineVal;
        const changePercent = baselineVal > 0 ? (change / baselineVal * 100) : 0;

        return `
            <tr>
                <td class="font-medium">${r.ticker || r.name}</td>
                <td>${Format.currency(baselineVal)}</td>
                <td>${Format.currency(r.totalValuation)}</td>
                <td class="${change >= 0 ? 'val-positive' : 'val-negative'}">
                    ${change >= 0 ? '+' : ''}${Format.currency(change)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%)
                </td>
                <td>${Format.currency(r.marketCap)}</td>
                <td class="${r.diff > 0 ? 'val-positive' : 'val-negative'}">
                    ${r.diff > 0 ? '+' : ''}${Format.currency(r.diff)}
                </td>
            </tr>
        `;
    }).join('');

    // Update chart
    updateScenarioChart();
}

// Update comparison chart
function updateScenarioChart() {
    const ctx = document.getElementById('scenario-chart');
    if (!ctx) return;

    Charts.destroy('scenario-chart');

    const labels = currentScenario.results.map(r => r.ticker || r.name);
    const baselineData = labels.map(label => {
        const b = baselineValuations.find(v => (v.ticker || v.name) === label);
        return b ? b.totalValuation / 1e9 : 0;
    });
    const scenarioData = currentScenario.results.map(r => r.totalValuation / 1e9);

    Charts.instances['scenario-chart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Baseline',
                    data: baselineData,
                    backgroundColor: Charts.colors.gray
                },
                {
                    label: 'Scenario',
                    data: scenarioData,
                    backgroundColor: Charts.colors.orange
                }
            ]
        },
        options: {
            ...Charts.darkThemeOptions,
            scales: {
                x: { ticks: { color: '#9ca3af' }, grid: { display: false } },
                y: {
                    ticks: { color: '#9ca3af', callback: v => '$' + v.toFixed(1) + 'B' },
                    grid: { color: '#374151' }
                }
            }
        }
    });
}

// Reset to current settings
async function resetScenario() {
    const settings = await API.getSettings();
    const s = settings.settings;

    document.getElementById('scenario-btc').value = s.btc_price;
    document.getElementById('scenario-mw-energized').value = s.mw_value_energized;
    document.getElementById('scenario-mw-contracted').value = s.mw_value_contracted;
    document.getElementById('scenario-mw-planned').value = s.mw_value_planned;
    document.getElementById('scenario-discount-op').value = s.discount_operational;
    document.getElementById('scenario-discount-const').value = s.discount_under_construction;
    document.getElementById('scenario-discount-plan').value = s.discount_planned;

    runScenario();
}

// Save scenario as default settings
async function saveScenarioAsDefault() {
    const updates = [
        ['btc_price', document.getElementById('scenario-btc').value],
        ['mw_value_energized', document.getElementById('scenario-mw-energized').value],
        ['mw_value_contracted', document.getElementById('scenario-mw-contracted').value],
        ['mw_value_planned', document.getElementById('scenario-mw-planned').value],
        ['discount_operational', document.getElementById('scenario-discount-op').value],
        ['discount_under_construction', document.getElementById('scenario-discount-const').value],
        ['discount_planned', document.getElementById('scenario-discount-plan').value]
    ];

    for (const [key, value] of updates) {
        await API.updateSetting(key, value);
    }

    toast('Settings saved as new defaults', 'success');
    await Valuation.loadSettings();
}

// Apply preset scenarios
function applyPreset(preset) {
    const presets = {
        bull: { btc: 100000 },
        bear: { btc: 40000 },
        premium: { mwEnergized: 3000000, mwContracted: 1500000, mwPlanned: 750000 },
        discount: { mwEnergized: 1400000, mwContracted: 700000, mwPlanned: 350000 },
        aggressive: { discountOp: 1.0, discountConst: 0.8, discountPlan: 0.5 },
        conservative: { discountOp: 0.9, discountConst: 0.5, discountPlan: 0.2 }
    };

    const p = presets[preset];
    if (!p) return;

    if (p.btc) document.getElementById('scenario-btc').value = p.btc;
    if (p.mwEnergized) document.getElementById('scenario-mw-energized').value = p.mwEnergized;
    if (p.mwContracted) document.getElementById('scenario-mw-contracted').value = p.mwContracted;
    if (p.mwPlanned) document.getElementById('scenario-mw-planned').value = p.mwPlanned;
    if (p.discountOp !== undefined) document.getElementById('scenario-discount-op').value = p.discountOp;
    if (p.discountConst !== undefined) document.getElementById('scenario-discount-const').value = p.discountConst;
    if (p.discountPlan !== undefined) document.getElementById('scenario-discount-plan').value = p.discountPlan;

    runScenario();
    toast(`Applied ${preset} scenario`, 'info');
}
