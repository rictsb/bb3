// CSV Import functionality

function showImportModal() {
    showModal(`
        <div class="modal-header">
            <h2 class="modal-title">Import Data</h2>
            <button onclick="closeModal()" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
            <div class="mb-4">
                <label class="form-label">Data Type</label>
                <select id="import-type" class="form-select" onchange="updateImportTemplate()">
                    <option value="companies">Companies</option>
                    <option value="sites">Sites</option>
                    <option value="subsites">Phases/Buildings</option>
                    <option value="hardware">Hardware</option>
                </select>
            </div>

            <div class="mb-4">
                <label class="form-label">CSV File</label>
                <input type="file" id="import-file" accept=".csv" class="form-input" onchange="previewImport()">
            </div>

            <div id="import-template" class="mb-4 p-3 bg-gray-700 rounded text-xs">
                <div class="font-medium mb-2">Expected columns for Companies:</div>
                <code class="text-green-400">name,ticker,website,btc_holdings,hash_rate_eh,market_cap_usd,debt_usd,notes</code>
                <div class="mt-2 text-gray-400">
                    <a href="#" onclick="downloadTemplate('companies')" class="text-orange-400 hover:underline">Download template CSV</a>
                </div>
            </div>

            <div id="import-preview" class="hidden mb-4">
                <label class="form-label">Preview (first 5 rows)</label>
                <div class="overflow-x-auto bg-gray-700 rounded p-2">
                    <table id="preview-table" class="text-xs w-full">
                    </table>
                </div>
                <div id="import-stats" class="mt-2 text-sm text-gray-400"></div>
            </div>

            <div id="import-errors" class="hidden mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-sm text-red-300">
            </div>
        </div>
        <div class="modal-footer">
            <button type="button" onclick="closeModal()" class="btn btn-secondary">Cancel</button>
            <button type="button" onclick="executeImport()" class="btn btn-primary" id="import-btn" disabled>Import Data</button>
        </div>
    `);
}

// Update template text based on selected type
function updateImportTemplate() {
    const type = document.getElementById('import-type').value;
    const templates = {
        companies: {
            columns: 'name,ticker,website,btc_holdings,hash_rate_eh,market_cap_usd,debt_usd,notes',
            required: 'name'
        },
        sites: {
            columns: 'company_name,name,city,state,country,total_mw_capacity,status,utility_provider,power_cost_kwh,power_source,notes',
            required: 'company_name, name'
        },
        subsites: {
            columns: 'company_name,site_name,name,mw_contracted,mw_energized,hash_rate_eh,status,energization_date,notes',
            required: 'company_name, site_name, name'
        },
        hardware: {
            columns: 'company_name,site_name,subsite_name,model,manufacturer,quantity,hash_rate_th_each,power_watts_each,status',
            required: 'company_name, site_name, subsite_name, model'
        }
    };

    const template = templates[type];
    document.getElementById('import-template').innerHTML = `
        <div class="font-medium mb-2">Expected columns for ${type}:</div>
        <code class="text-green-400">${template.columns}</code>
        <div class="text-gray-400 mt-1">Required: <span class="text-yellow-400">${template.required}</span></div>
        <div class="mt-2">
            <a href="#" onclick="downloadTemplate('${type}')" class="text-orange-400 hover:underline">Download template CSV</a>
        </div>
    `;

    // Clear preview
    document.getElementById('import-preview').classList.add('hidden');
    document.getElementById('import-errors').classList.add('hidden');
    document.getElementById('import-btn').disabled = true;
}

// Parse CSV text
function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    const headers = parseCSVLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((h, idx) => {
                row[h.trim()] = values[idx];
            });
            rows.push(row);
        }
    }

    return { headers, rows };
}

// Parse single CSV line handling quotes
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

// Preview import file
let importData = null;

function previewImport() {
    const file = document.getElementById('import-file').files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        importData = parseCSV(text);

        if (importData.rows.length === 0) {
            document.getElementById('import-errors').innerHTML = 'No valid data rows found in CSV';
            document.getElementById('import-errors').classList.remove('hidden');
            document.getElementById('import-preview').classList.add('hidden');
            document.getElementById('import-btn').disabled = true;
            return;
        }

        // Show preview
        const previewRows = importData.rows.slice(0, 5);
        let tableHtml = '<thead><tr>';
        importData.headers.forEach(h => {
            tableHtml += `<th class="px-2 py-1 text-left border-b border-gray-600">${h}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        previewRows.forEach(row => {
            tableHtml += '<tr>';
            importData.headers.forEach(h => {
                const val = row[h] || '';
                tableHtml += `<td class="px-2 py-1 border-b border-gray-700">${val.substring(0, 30)}${val.length > 30 ? '...' : ''}</td>`;
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</tbody>';

        document.getElementById('preview-table').innerHTML = tableHtml;
        document.getElementById('import-stats').textContent = `Total rows: ${importData.rows.length}`;
        document.getElementById('import-preview').classList.remove('hidden');
        document.getElementById('import-errors').classList.add('hidden');
        document.getElementById('import-btn').disabled = false;
    };

    reader.readAsText(file);
}

// Execute import
async function executeImport() {
    if (!importData || !importData.rows.length) return;

    const type = document.getElementById('import-type').value;
    const btn = document.getElementById('import-btn');
    btn.disabled = true;
    btn.textContent = 'Importing...';

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const row of importData.rows) {
        try {
            await importRow(type, row);
            successCount++;
        } catch (e) {
            errorCount++;
            errors.push(`Row error: ${e.message}`);
        }
    }

    if (errors.length > 0) {
        document.getElementById('import-errors').innerHTML = errors.slice(0, 5).join('<br>') +
            (errors.length > 5 ? `<br>... and ${errors.length - 5} more errors` : '');
        document.getElementById('import-errors').classList.remove('hidden');
    }

    toast(`Imported ${successCount} records${errorCount > 0 ? `, ${errorCount} errors` : ''}`,
          errorCount > 0 ? 'error' : 'success');

    if (successCount > 0) {
        // Refresh data
        await loadCompaniesCache();
        refreshSearchCache();
        closeModal();
        navigate(currentPage);
    }

    btn.disabled = false;
    btn.textContent = 'Import Data';
}

// Import single row based on type
async function importRow(type, row) {
    switch (type) {
        case 'companies':
            return API.createCompany({
                name: row.name,
                ticker: row.ticker || null,
                website: row.website || null,
                btc_holdings: parseFloat(row.btc_holdings) || 0,
                hash_rate_eh: parseFloat(row.hash_rate_eh) || 0,
                market_cap_usd: parseFloat(row.market_cap_usd) || null,
                debt_usd: parseFloat(row.debt_usd) || 0,
                notes: row.notes || null
            });

        case 'sites':
            // Find company by name
            const company = companiesCache.find(c =>
                c.name.toLowerCase() === (row.company_name || '').toLowerCase()
            );
            if (!company) throw new Error(`Company not found: ${row.company_name}`);

            return API.createSite({
                company_id: company.id,
                name: row.name,
                city: row.city || null,
                state: row.state || null,
                country: row.country || 'USA',
                total_mw_capacity: parseFloat(row.total_mw_capacity) || null,
                status: row.status || 'planned',
                utility_provider: row.utility_provider || null,
                power_cost_kwh: parseFloat(row.power_cost_kwh) || null,
                power_source: row.power_source || null,
                notes: row.notes || null
            });

        case 'subsites':
            // Find site by company and site name
            const sites = await API.getSites();
            const site = sites.find(s =>
                s.company_name.toLowerCase() === (row.company_name || '').toLowerCase() &&
                s.name.toLowerCase() === (row.site_name || '').toLowerCase()
            );
            if (!site) throw new Error(`Site not found: ${row.company_name} / ${row.site_name}`);

            return API.createSubsite({
                site_id: site.id,
                name: row.name,
                mw_contracted: parseFloat(row.mw_contracted) || 0,
                mw_energized: parseFloat(row.mw_energized) || 0,
                hash_rate_eh: parseFloat(row.hash_rate_eh) || 0,
                status: row.status || 'planned',
                energization_date: row.energization_date || null,
                notes: row.notes || null
            });

        case 'hardware':
            // Find subsite
            const subsites = await API.getSubsites();
            const subsite = subsites.find(sub =>
                sub.company_name.toLowerCase() === (row.company_name || '').toLowerCase() &&
                sub.site_name.toLowerCase() === (row.site_name || '').toLowerCase() &&
                sub.name.toLowerCase() === (row.subsite_name || '').toLowerCase()
            );
            if (!subsite) throw new Error(`Subsite not found: ${row.company_name} / ${row.site_name} / ${row.subsite_name}`);

            return API.createHardware({
                subsite_id: subsite.id,
                model: row.model,
                manufacturer: row.manufacturer || null,
                quantity: parseInt(row.quantity) || 0,
                hash_rate_th_each: parseFloat(row.hash_rate_th_each) || null,
                power_watts_each: parseFloat(row.power_watts_each) || null,
                status: row.status || 'deployed'
            });

        default:
            throw new Error(`Unknown import type: ${type}`);
    }
}

// Download template CSV
function downloadTemplate(type) {
    const templates = {
        companies: 'name,ticker,website,btc_holdings,hash_rate_eh,market_cap_usd,debt_usd,notes\nExample Corp,EXMP,https://example.com,1000,5.5,500000000,0,Notes here',
        sites: 'company_name,name,city,state,country,total_mw_capacity,status,utility_provider,power_cost_kwh,power_source,notes\nExample Corp,Main Facility,Austin,TX,USA,100,operational,ERCOT,0.03,Grid,',
        subsites: 'company_name,site_name,name,mw_contracted,mw_energized,hash_rate_eh,status,energization_date,notes\nExample Corp,Main Facility,Phase 1,50,50,1.5,operational,2024-01-15,',
        hardware: 'company_name,site_name,subsite_name,model,manufacturer,quantity,hash_rate_th_each,power_watts_each,status\nExample Corp,Main Facility,Phase 1,Antminer S19 XP,Bitmain,1000,140,3010,deployed'
    };

    const csv = templates[type];
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
