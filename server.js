// Bitcoin Mining Data Center Tracker - Server
// Run with: npm start

const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
const DB_PATH = path.join(__dirname, 'database', 'mining.db');
if (!fs.existsSync(DB_PATH)) {
    console.log('Database not found. Run "npm run init-db" first.');
    process.exit(1);
}
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// Helper: Update timestamp trigger
const touch = (table, id) => {
    db.prepare(`UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
};

// ============================================================================
// COMPANIES API
// ============================================================================

app.get('/api/companies', (req, res) => {
    const companies = db.prepare(`
        SELECT * FROM v_company_summary ORDER BY name
    `).all();
    res.json(companies);
});

app.get('/api/companies/:id', (req, res) => {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    // Get sites for this company
    const sites = db.prepare('SELECT * FROM v_site_summary WHERE company_id = ?').all(req.params.id);
    company.sites = sites;

    res.json(company);
});

app.post('/api/companies', (req, res) => {
    const { name, ticker, website, btc_holdings, hash_rate_eh, market_cap_usd, debt_usd, notes } = req.body;
    try {
        const result = db.prepare(`
            INSERT INTO companies (name, ticker, website, btc_holdings, hash_rate_eh, market_cap_usd, debt_usd, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(name, ticker, website, btc_holdings || 0, hash_rate_eh || 0, market_cap_usd, debt_usd || 0, notes);
        res.json({ id: result.lastInsertRowid, message: 'Company created' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/companies/:id', (req, res) => {
    const { name, ticker, website, btc_holdings, hash_rate_eh, market_cap_usd, debt_usd, notes } = req.body;
    try {
        db.prepare(`
            UPDATE companies SET
                name = COALESCE(?, name),
                ticker = COALESCE(?, ticker),
                website = COALESCE(?, website),
                btc_holdings = COALESCE(?, btc_holdings),
                hash_rate_eh = COALESCE(?, hash_rate_eh),
                market_cap_usd = COALESCE(?, market_cap_usd),
                debt_usd = COALESCE(?, debt_usd),
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(name, ticker, website, btc_holdings, hash_rate_eh, market_cap_usd, debt_usd, notes, req.params.id);
        res.json({ message: 'Company updated' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/companies/:id', (req, res) => {
    db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
    res.json({ message: 'Company deleted' });
});

// ============================================================================
// SITES API
// ============================================================================

app.get('/api/sites', (req, res) => {
    let query = 'SELECT * FROM v_site_summary WHERE 1=1';
    const params = [];

    // Filtering
    if (req.query.state) {
        query += ' AND state = ?';
        params.push(req.query.state);
    }
    if (req.query.status) {
        query += ' AND status = ?';
        params.push(req.query.status);
    }
    if (req.query.min_mw) {
        query += ' AND total_mw_capacity >= ?';
        params.push(parseFloat(req.query.min_mw));
    }
    if (req.query.company_id) {
        query += ' AND company_id = ?';
        params.push(parseInt(req.query.company_id));
    }

    query += ' ORDER BY company_name, name';
    const sites = db.prepare(query).all(...params);
    res.json(sites);
});

app.get('/api/sites/:id', (req, res) => {
    const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    // Get company name
    const company = db.prepare('SELECT name FROM companies WHERE id = ?').get(site.company_id);
    site.company_name = company?.name;

    // Get subsites
    const subsites = db.prepare('SELECT * FROM subsites WHERE site_id = ? ORDER BY name').all(req.params.id);
    site.subsites = subsites;

    res.json(site);
});

app.post('/api/sites', (req, res) => {
    const { company_id, name, address, city, state, country, latitude, longitude,
        total_mw_capacity, land_acres, status, utility_provider, ppa_term_years,
        power_cost_kwh, power_source, notes } = req.body;
    try {
        const result = db.prepare(`
            INSERT INTO sites (company_id, name, address, city, state, country, latitude, longitude,
                total_mw_capacity, land_acres, status, utility_provider, ppa_term_years,
                power_cost_kwh, power_source, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(company_id, name, address, city, state, country || 'USA', latitude, longitude,
            total_mw_capacity, land_acres, status || 'planned', utility_provider, ppa_term_years,
            power_cost_kwh, power_source, notes);
        res.json({ id: result.lastInsertRowid, message: 'Site created' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/sites/:id', (req, res) => {
    const fields = ['company_id', 'name', 'address', 'city', 'state', 'country', 'latitude', 'longitude',
        'total_mw_capacity', 'land_acres', 'status', 'utility_provider', 'ppa_term_years',
        'power_cost_kwh', 'power_source', 'notes'];

    const updates = [];
    const values = [];

    for (const field of fields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`);
            values.push(req.body[field]);
        }
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    try {
        db.prepare(`UPDATE sites SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        res.json({ message: 'Site updated' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/sites/:id', (req, res) => {
    db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
    res.json({ message: 'Site deleted' });
});

// ============================================================================
// SUBSITES API
// ============================================================================

app.get('/api/subsites', (req, res) => {
    let query = 'SELECT sub.*, s.name as site_name, c.name as company_name FROM subsites sub JOIN sites s ON s.id = sub.site_id JOIN companies c ON c.id = s.company_id WHERE 1=1';
    const params = [];

    if (req.query.site_id) {
        query += ' AND sub.site_id = ?';
        params.push(parseInt(req.query.site_id));
    }

    query += ' ORDER BY c.name, s.name, sub.name';
    res.json(db.prepare(query).all(...params));
});

app.get('/api/subsites/:id', (req, res) => {
    const subsite = db.prepare(`
        SELECT sub.*, s.name as site_name, s.company_id, c.name as company_name
        FROM subsites sub
        JOIN sites s ON s.id = sub.site_id
        JOIN companies c ON c.id = s.company_id
        WHERE sub.id = ?
    `).get(req.params.id);

    if (!subsite) return res.status(404).json({ error: 'Subsite not found' });

    // Get hardware
    subsite.hardware = db.prepare('SELECT * FROM hardware WHERE subsite_id = ?').all(req.params.id);

    res.json(subsite);
});

app.post('/api/subsites', (req, res) => {
    const { site_id, name, mw_contracted, mw_energized, hash_rate_eh, status, energization_date, notes } = req.body;
    try {
        const result = db.prepare(`
            INSERT INTO subsites (site_id, name, mw_contracted, mw_energized, hash_rate_eh, status, energization_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(site_id, name, mw_contracted || 0, mw_energized || 0, hash_rate_eh || 0, status || 'planned', energization_date, notes);
        res.json({ id: result.lastInsertRowid, message: 'Subsite created' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/subsites/:id', (req, res) => {
    const fields = ['site_id', 'name', 'mw_contracted', 'mw_energized', 'hash_rate_eh', 'status', 'energization_date', 'notes'];
    const updates = [];
    const values = [];

    for (const field of fields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`);
            values.push(req.body[field]);
        }
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    try {
        db.prepare(`UPDATE subsites SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        res.json({ message: 'Subsite updated' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/subsites/:id', (req, res) => {
    db.prepare('DELETE FROM subsites WHERE id = ?').run(req.params.id);
    res.json({ message: 'Subsite deleted' });
});

// ============================================================================
// HARDWARE API
// ============================================================================

app.get('/api/hardware', (req, res) => {
    let query = 'SELECT * FROM hardware WHERE 1=1';
    const params = [];

    if (req.query.subsite_id) {
        query += ' AND subsite_id = ?';
        params.push(parseInt(req.query.subsite_id));
    }

    res.json(db.prepare(query).all(...params));
});

app.post('/api/hardware', (req, res) => {
    const { subsite_id, model, manufacturer, quantity, hash_rate_th_each, power_watts_each, status, deployment_date, notes } = req.body;
    try {
        const result = db.prepare(`
            INSERT INTO hardware (subsite_id, model, manufacturer, quantity, hash_rate_th_each, power_watts_each, status, deployment_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(subsite_id, model, manufacturer, quantity || 0, hash_rate_th_each, power_watts_each, status || 'deployed', deployment_date, notes);
        res.json({ id: result.lastInsertRowid, message: 'Hardware created' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/hardware/:id', (req, res) => {
    const fields = ['subsite_id', 'model', 'manufacturer', 'quantity', 'hash_rate_th_each', 'power_watts_each', 'status', 'deployment_date', 'notes'];
    const updates = [];
    const values = [];

    for (const field of fields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`);
            values.push(req.body[field]);
        }
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    db.prepare(`UPDATE hardware SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    res.json({ message: 'Hardware updated' });
});

app.delete('/api/hardware/:id', (req, res) => {
    db.prepare('DELETE FROM hardware WHERE id = ?').run(req.params.id);
    res.json({ message: 'Hardware deleted' });
});

// ============================================================================
// NEWS API
// ============================================================================

app.get('/api/news', (req, res) => {
    let query = `
        SELECT n.*, c.name as company_name, s.name as site_name
        FROM news n
        LEFT JOIN companies c ON c.id = n.company_id
        LEFT JOIN sites s ON s.id = n.site_id
        WHERE 1=1
    `;
    const params = [];

    if (req.query.status) {
        query += ' AND n.status = ?';
        params.push(req.query.status);
    }
    if (req.query.company_id) {
        query += ' AND n.company_id = ?';
        params.push(parseInt(req.query.company_id));
    }

    query += ' ORDER BY n.created_at DESC';
    res.json(db.prepare(query).all(...params));
});

app.get('/api/news/:id', (req, res) => {
    const news = db.prepare(`
        SELECT n.*, c.name as company_name, s.name as site_name
        FROM news n
        LEFT JOIN companies c ON c.id = n.company_id
        LEFT JOIN sites s ON s.id = n.site_id
        WHERE n.id = ?
    `).get(req.params.id);

    if (!news) return res.status(404).json({ error: 'News not found' });

    // Get tags
    news.tags = db.prepare('SELECT tag FROM news_tags WHERE news_id = ?').all(req.params.id).map(t => t.tag);

    res.json(news);
});

app.post('/api/news', (req, res) => {
    const { company_id, site_id, title, source, url, publish_date, content, summary, status, extracted_data, tags } = req.body;
    try {
        const result = db.prepare(`
            INSERT INTO news (company_id, site_id, title, source, url, publish_date, content, summary, status, extracted_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(company_id, site_id, title, source, url, publish_date, content, summary, status || 'pending', extracted_data ? JSON.stringify(extracted_data) : null);

        // Add tags
        if (tags && Array.isArray(tags)) {
            const insertTag = db.prepare('INSERT INTO news_tags (news_id, tag) VALUES (?, ?)');
            for (const tag of tags) {
                insertTag.run(result.lastInsertRowid, tag);
            }
        }

        res.json({ id: result.lastInsertRowid, message: 'News created' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/news/:id', (req, res) => {
    const fields = ['company_id', 'site_id', 'title', 'source', 'url', 'publish_date', 'content', 'summary', 'status'];
    const updates = [];
    const values = [];

    for (const field of fields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`);
            values.push(req.body[field]);
        }
    }

    if (req.body.status === 'approved' || req.body.status === 'rejected') {
        updates.push('reviewed_at = CURRENT_TIMESTAMP');
    }

    values.push(req.params.id);
    db.prepare(`UPDATE news SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Update tags if provided
    if (req.body.tags) {
        db.prepare('DELETE FROM news_tags WHERE news_id = ?').run(req.params.id);
        const insertTag = db.prepare('INSERT INTO news_tags (news_id, tag) VALUES (?, ?)');
        for (const tag of req.body.tags) {
            insertTag.run(req.params.id, tag);
        }
    }

    res.json({ message: 'News updated' });
});

app.delete('/api/news/:id', (req, res) => {
    db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id);
    res.json({ message: 'News deleted' });
});

// ============================================================================
// REVIEW QUEUE API
// ============================================================================

app.get('/api/review', (req, res) => {
    let query = 'SELECT * FROM review_queue WHERE 1=1';
    const params = [];

    if (req.query.status) {
        query += ' AND status = ?';
        params.push(req.query.status);
    }

    query += ' ORDER BY created_at DESC';
    res.json(db.prepare(query).all(...params));
});

app.post('/api/review', (req, res) => {
    const { entity_type, entity_id, proposed_data, source, source_news_id } = req.body;
    try {
        const result = db.prepare(`
            INSERT INTO review_queue (entity_type, entity_id, proposed_data, source, source_news_id)
            VALUES (?, ?, ?, ?, ?)
        `).run(entity_type, entity_id, JSON.stringify(proposed_data), source, source_news_id);
        res.json({ id: result.lastInsertRowid, message: 'Review item created' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Approve or reject review item
app.post('/api/review/:id/decide', (req, res) => {
    const { action, reviewer_notes } = req.body; // action: 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
    }

    const item = db.prepare('SELECT * FROM review_queue WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Review item not found' });

    if (action === 'approve') {
        // Apply the proposed changes
        const data = JSON.parse(item.proposed_data);
        const table = item.entity_type === 'company' ? 'companies' :
            item.entity_type === 'site' ? 'sites' :
                item.entity_type === 'subsite' ? 'subsites' : 'hardware';

        if (item.entity_id) {
            // Update existing record
            const fields = Object.keys(data);
            const updates = fields.map(f => `${f} = ?`).join(', ');
            const values = fields.map(f => data[f]);
            values.push(item.entity_id);
            db.prepare(`UPDATE ${table} SET ${updates}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
        } else {
            // Insert new record
            const fields = Object.keys(data);
            const placeholders = fields.map(() => '?').join(', ');
            const values = fields.map(f => data[f]);
            db.prepare(`INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`).run(...values);
        }
    }

    // Update review status
    db.prepare(`
        UPDATE review_queue SET status = ?, reviewer_notes = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(action === 'approve' ? 'approved' : 'rejected', reviewer_notes, req.params.id);

    res.json({ message: `Review item ${action}d` });
});

// ============================================================================
// VALUATION SETTINGS API
// ============================================================================

app.get('/api/settings', (req, res) => {
    const settings = db.prepare('SELECT * FROM valuation_settings ORDER BY category, key').all();
    const multipliers = db.prepare('SELECT * FROM custom_multipliers ORDER BY name').all();

    // Convert to object for easier access
    const settingsObj = {};
    for (const s of settings) {
        settingsObj[s.key] = s.value;
    }

    res.json({ settings: settingsObj, settingsDetails: settings, multipliers });
});

app.put('/api/settings/:key', (req, res) => {
    const { value } = req.body;
    db.prepare(`
        UPDATE valuation_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?
    `).run(value.toString(), req.params.key);
    res.json({ message: 'Setting updated' });
});

// Custom multipliers
app.post('/api/multipliers', (req, res) => {
    const { name, multiplier, description, scope, scope_value, is_active } = req.body;
    const result = db.prepare(`
        INSERT INTO custom_multipliers (name, multiplier, description, scope, scope_value, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, multiplier, description, scope || 'global', scope_value, is_active ?? 1);
    res.json({ id: result.lastInsertRowid, message: 'Multiplier created' });
});

app.put('/api/multipliers/:id', (req, res) => {
    const { name, multiplier, description, scope, scope_value, is_active } = req.body;
    db.prepare(`
        UPDATE custom_multipliers SET name = ?, multiplier = ?, description = ?, scope = ?, scope_value = ?, is_active = ?
        WHERE id = ?
    `).run(name, multiplier, description, scope, scope_value, is_active, req.params.id);
    res.json({ message: 'Multiplier updated' });
});

app.delete('/api/multipliers/:id', (req, res) => {
    db.prepare('DELETE FROM custom_multipliers WHERE id = ?').run(req.params.id);
    res.json({ message: 'Multiplier deleted' });
});

// ============================================================================
// VALUATION CALCULATION API
// ============================================================================

app.get('/api/valuation/company/:id', (req, res) => {
    const company = db.prepare('SELECT * FROM v_company_summary WHERE id = ?').get(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const sites = db.prepare('SELECT * FROM v_site_summary WHERE company_id = ?').all(req.params.id);
    const settings = {};
    db.prepare('SELECT key, value FROM valuation_settings').all().forEach(s => settings[s.key] = parseFloat(s.value) || s.value);
    const multipliers = db.prepare('SELECT * FROM custom_multipliers WHERE is_active = 1').all();

    // Calculate site valuations
    let totalSiteValue = 0;
    const siteValuations = sites.map(site => {
        let siteValue = 0;

        // MW-based valuation
        const energizedValue = (site.total_mw_energized || 0) * settings.mw_value_energized;
        const contractedValue = ((site.total_mw_contracted || 0) - (site.total_mw_energized || 0)) * settings.mw_value_contracted;
        const plannedValue = ((site.total_mw_capacity || 0) - (site.total_mw_contracted || 0)) * settings.mw_value_planned;

        siteValue = energizedValue + contractedValue + plannedValue;

        // Apply status discount
        const discountKey = `discount_${site.status}`;
        const discount = settings[discountKey] || 1.0;
        siteValue *= discount;

        // Apply power cost multiplier
        if (site.power_cost_kwh) {
            if (site.power_cost_kwh < settings.power_tier_cheap_threshold) {
                siteValue *= settings.power_tier_cheap_multiplier;
            } else if (site.power_cost_kwh > settings.power_tier_expensive_threshold) {
                siteValue *= settings.power_tier_expensive_multiplier;
            }
        }

        // Apply custom multipliers
        for (const m of multipliers) {
            if (m.scope === 'global' ||
                (m.scope === 'state' && m.scope_value === site.state) ||
                (m.scope === 'site' && parseInt(m.scope_value) === site.id)) {
                siteValue *= m.multiplier;
            }
        }

        totalSiteValue += siteValue;

        return {
            ...site,
            valuation: siteValue,
            components: { energizedValue, contractedValue, plannedValue, discount }
        };
    });

    // Hash rate valuation
    const hashRateValue = (company.hash_rate_eh || 0) * settings.eh_value;

    // BTC holdings value
    const btcPrice = parseFloat(settings.btc_price) || 60000;
    const btcValue = (company.btc_holdings || 0) * btcPrice;

    // Total valuation
    const totalValuation = totalSiteValue + btcValue;

    // Compare to market cap
    const marketCap = company.market_cap_usd || 0;
    const valuationDiff = totalValuation - marketCap;
    const valuationRatio = marketCap > 0 ? totalValuation / marketCap : null;

    res.json({
        company: company,
        sites: siteValuations,
        valuation: {
            siteValue: totalSiteValue,
            hashRateValue,
            btcValue,
            total: totalValuation,
            marketCap,
            diff: valuationDiff,
            ratio: valuationRatio
        },
        settings
    });
});

// Get valuation for all companies
app.get('/api/valuation/all', (req, res) => {
    const companies = db.prepare('SELECT * FROM v_company_summary').all();
    const settings = {};
    db.prepare('SELECT key, value FROM valuation_settings').all().forEach(s => settings[s.key] = parseFloat(s.value) || s.value);
    const multipliers = db.prepare('SELECT * FROM custom_multipliers WHERE is_active = 1').all();

    const results = companies.map(company => {
        const sites = db.prepare('SELECT * FROM v_site_summary WHERE company_id = ?').all(company.id);

        let totalSiteValue = 0;
        for (const site of sites) {
            let siteValue = 0;
            siteValue += (site.total_mw_energized || 0) * settings.mw_value_energized;
            siteValue += ((site.total_mw_contracted || 0) - (site.total_mw_energized || 0)) * settings.mw_value_contracted;
            siteValue += ((site.total_mw_capacity || 0) - (site.total_mw_contracted || 0)) * settings.mw_value_planned;

            const discountKey = `discount_${site.status}`;
            siteValue *= settings[discountKey] || 1.0;

            if (site.power_cost_kwh) {
                if (site.power_cost_kwh < settings.power_tier_cheap_threshold) {
                    siteValue *= settings.power_tier_cheap_multiplier;
                } else if (site.power_cost_kwh > settings.power_tier_expensive_threshold) {
                    siteValue *= settings.power_tier_expensive_multiplier;
                }
            }

            for (const m of multipliers) {
                if (m.scope === 'global' ||
                    (m.scope === 'state' && m.scope_value === site.state) ||
                    (m.scope === 'site' && parseInt(m.scope_value) === site.id)) {
                    siteValue *= m.multiplier;
                }
            }

            totalSiteValue += siteValue;
        }

        const btcPrice = parseFloat(settings.btc_price) || 60000;
        const btcValue = (company.btc_holdings || 0) * btcPrice;
        const totalValuation = totalSiteValue + btcValue;
        const marketCap = company.market_cap_usd || 0;

        return {
            id: company.id,
            name: company.name,
            ticker: company.ticker,
            siteValue: totalSiteValue,
            btcValue,
            totalValuation,
            marketCap,
            diff: totalValuation - marketCap,
            ratio: marketCap > 0 ? totalValuation / marketCap : null,
            totalMwEnergized: company.total_mw_energized,
            totalMwCapacity: company.total_mw_capacity,
            hashRateEh: company.hash_rate_eh,
            btcHoldings: company.btc_holdings
        };
    });

    res.json(results);
});

// ============================================================================
// EXPORT API
// ============================================================================

app.get('/api/export/:type', (req, res) => {
    const { type } = req.params;
    const format = req.query.format || 'json';

    let data;
    switch (type) {
        case 'companies':
            data = db.prepare('SELECT * FROM v_company_summary').all();
            break;
        case 'sites':
            data = db.prepare('SELECT * FROM v_site_summary').all();
            break;
        case 'subsites':
            data = db.prepare(`
                SELECT sub.*, s.name as site_name, c.name as company_name
                FROM subsites sub
                JOIN sites s ON s.id = sub.site_id
                JOIN companies c ON c.id = s.company_id
            `).all();
            break;
        case 'hardware':
            data = db.prepare(`
                SELECT h.*, sub.name as subsite_name, s.name as site_name, c.name as company_name
                FROM hardware h
                JOIN subsites sub ON sub.id = h.subsite_id
                JOIN sites s ON s.id = sub.site_id
                JOIN companies c ON c.id = s.company_id
            `).all();
            break;
        case 'all':
            data = {
                companies: db.prepare('SELECT * FROM companies').all(),
                sites: db.prepare('SELECT * FROM sites').all(),
                subsites: db.prepare('SELECT * FROM subsites').all(),
                hardware: db.prepare('SELECT * FROM hardware').all(),
                news: db.prepare('SELECT * FROM news WHERE status = ?').all('approved'),
                settings: db.prepare('SELECT * FROM valuation_settings').all(),
                multipliers: db.prepare('SELECT * FROM custom_multipliers').all()
            };
            break;
        default:
            return res.status(400).json({ error: 'Invalid export type' });
    }

    if (format === 'csv' && type !== 'all') {
        // Simple CSV conversion
        if (!data.length) {
            return res.type('text/csv').send('');
        }
        const headers = Object.keys(data[0]);
        const csv = [
            headers.join(','),
            ...data.map(row => headers.map(h => {
                const val = row[h];
                if (val === null || val === undefined) return '';
                if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                    return `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            }).join(','))
        ].join('\n');
        res.type('text/csv').send(csv);
    } else {
        res.json(data);
    }
});

// ============================================================================
// STATS/DASHBOARD API
// ============================================================================

app.get('/api/stats', (req, res) => {
    const stats = {
        companies: db.prepare('SELECT COUNT(*) as count FROM companies').get().count,
        sites: db.prepare('SELECT COUNT(*) as count FROM sites').get().count,
        subsites: db.prepare('SELECT COUNT(*) as count FROM subsites').get().count,
        pendingNews: db.prepare('SELECT COUNT(*) as count FROM news WHERE status = ?').get('pending').count,
        pendingReview: db.prepare('SELECT COUNT(*) as count FROM review_queue WHERE status = ?').get('pending').count,
        totalMwEnergized: db.prepare('SELECT COALESCE(SUM(mw_energized), 0) as total FROM subsites').get().total,
        totalMwCapacity: db.prepare('SELECT COALESCE(SUM(total_mw_capacity), 0) as total FROM sites').get().total,
        sitesByStatus: db.prepare(`
            SELECT status, COUNT(*) as count FROM sites GROUP BY status
        `).all(),
        sitesByState: db.prepare(`
            SELECT state, COUNT(*) as count FROM sites WHERE state IS NOT NULL GROUP BY state ORDER BY count DESC LIMIT 10
        `).all()
    };
    res.json(stats);
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Bitcoin Mining Data Center Tracker                    ║
║     Server running at http://localhost:${PORT}               ║
╚═══════════════════════════════════════════════════════════╝
    `);
});
