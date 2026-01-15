-- Bitcoin Mining Data Center Tracker - Database Schema
-- SQLite database for tracking mining companies, sites, and subsites

-- ============================================================================
-- CORE ENTITIES
-- ============================================================================

-- Companies (e.g., Marathon, Riot, CleanSpark)
CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    ticker TEXT,                          -- Stock ticker if public
    website TEXT,

    -- Financials (updated periodically)
    btc_holdings REAL DEFAULT 0,          -- BTC held on balance sheet
    hash_rate_eh REAL DEFAULT 0,          -- Total hash rate in EH/s
    market_cap_usd REAL,                  -- Market cap in USD
    debt_usd REAL DEFAULT 0,              -- Total debt

    -- Metadata
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sites (e.g., "Ellendale, ND facility")
CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    name TEXT NOT NULL,                   -- e.g., "Ellendale Facility"

    -- Location
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'USA',
    latitude REAL,
    longitude REAL,

    -- Capacity & Land
    total_mw_capacity REAL,               -- Total planned MW
    land_acres REAL,

    -- Status: planned | under_construction | operational | curtailed | closed
    status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'under_construction', 'operational', 'curtailed', 'closed')),

    -- Power Contract Details
    utility_provider TEXT,
    ppa_term_years REAL,                  -- Power Purchase Agreement term
    power_cost_kwh REAL,                  -- $/kWh if known
    power_source TEXT,                    -- e.g., "Grid", "Solar", "Wind", "Nuclear"

    -- Metadata
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Subsites / Phases (e.g., "Building 2" or "Phase 3 expansion")
CREATE TABLE IF NOT EXISTS subsites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL,
    name TEXT NOT NULL,                   -- e.g., "Phase 1", "Building A"

    -- Capacity
    mw_contracted REAL DEFAULT 0,         -- MW under contract
    mw_energized REAL DEFAULT 0,          -- MW actually energized
    hash_rate_eh REAL DEFAULT 0,          -- Hash rate contribution in EH/s

    -- Status
    status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'under_construction', 'operational', 'curtailed', 'closed')),
    energization_date DATE,               -- When power was/will be turned on

    -- Metadata
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Hardware deployed at subsites
CREATE TABLE IF NOT EXISTS hardware (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subsite_id INTEGER NOT NULL,

    model TEXT NOT NULL,                  -- e.g., "Antminer S19 XP"
    manufacturer TEXT,                    -- e.g., "Bitmain"
    quantity INTEGER DEFAULT 0,
    hash_rate_th_each REAL,               -- TH/s per unit
    power_watts_each REAL,                -- Watts per unit

    -- Status
    status TEXT DEFAULT 'deployed' CHECK(status IN ('ordered', 'delivered', 'deployed', 'offline')),
    deployment_date DATE,

    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (subsite_id) REFERENCES subsites(id) ON DELETE CASCADE
);

-- ============================================================================
-- NEWS & FILINGS
-- ============================================================================

-- News articles and SEC filings
CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- What this relates to (at least one should be set)
    company_id INTEGER,
    site_id INTEGER,

    -- Content
    title TEXT NOT NULL,
    source TEXT,                          -- e.g., "SEC 10-K", "Bloomberg", "Company PR"
    url TEXT,
    publish_date DATE,
    content TEXT,                         -- Full text or excerpt
    summary TEXT,                         -- AI or manual summary

    -- Review status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),

    -- Extracted data (JSON) - for structured info pulled from article
    extracted_data TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
);

-- Tags for news items
CREATE TABLE IF NOT EXISTS news_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    news_id INTEGER NOT NULL,
    tag TEXT NOT NULL,

    FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE
);

-- ============================================================================
-- REVIEW QUEUE (for pending data changes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS review_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- What type of change: company | site | subsite | hardware
    entity_type TEXT NOT NULL,
    entity_id INTEGER,                    -- NULL if new record

    -- The proposed data (JSON)
    proposed_data TEXT NOT NULL,

    -- Source of this data
    source TEXT,                          -- e.g., "news_id:123" or "manual"
    source_news_id INTEGER,

    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    reviewer_notes TEXT,

    FOREIGN KEY (source_news_id) REFERENCES news(id) ON DELETE SET NULL
);

-- ============================================================================
-- VALUATION SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS valuation_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,                  -- Stored as TEXT, parsed as needed
    description TEXT,
    category TEXT,                        -- For grouping in UI
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default valuation settings
INSERT OR IGNORE INTO valuation_settings (key, value, description, category) VALUES
    -- $/MW valuations
    ('mw_value_energized', '2000000', '$/MW for energized capacity', 'capacity'),
    ('mw_value_contracted', '1000000', '$/MW for contracted but not energized', 'capacity'),
    ('mw_value_planned', '500000', '$/MW for planned capacity', 'capacity'),

    -- $/EH valuations
    ('eh_value', '100000000', '$/EH for hash rate', 'hashrate'),

    -- BTC assumptions
    ('btc_price', '60000', 'BTC price assumption (USD)', 'bitcoin'),
    ('btc_price_source', 'manual', 'manual or live', 'bitcoin'),

    -- Status discount rates (as decimal, 1.0 = 100%)
    ('discount_operational', '1.0', 'Discount rate for operational sites', 'discounts'),
    ('discount_under_construction', '0.6', 'Discount rate for under construction', 'discounts'),
    ('discount_planned', '0.3', 'Discount rate for planned sites', 'discounts'),
    ('discount_curtailed', '0.5', 'Discount rate for curtailed sites', 'discounts'),

    -- Power cost tiers (premium/discount based on $/kWh)
    ('power_tier_cheap_threshold', '0.03', 'kWh threshold for cheap power (<$0.03)', 'power'),
    ('power_tier_cheap_multiplier', '1.2', 'Multiplier for cheap power sites', 'power'),
    ('power_tier_expensive_threshold', '0.06', 'kWh threshold for expensive (>$0.06)', 'power'),
    ('power_tier_expensive_multiplier', '0.8', 'Multiplier for expensive power sites', 'power');

-- Custom multipliers (user-defined risk/premium factors)
CREATE TABLE IF NOT EXISTS custom_multipliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                   -- e.g., "Texas grid risk"
    multiplier REAL NOT NULL DEFAULT 1.0, -- e.g., 0.9 for 10% discount
    description TEXT,

    -- Scope: applies to specific entities or globally
    scope TEXT DEFAULT 'global',          -- global | company | site | state
    scope_value TEXT,                     -- e.g., state="TX" or company_id="5"

    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Example custom multipliers
INSERT OR IGNORE INTO custom_multipliers (name, multiplier, description, scope, scope_value) VALUES
    ('Texas Grid Risk', 0.95, 'ERCOT grid reliability concerns', 'state', 'TX'),
    ('Regulatory Uncertainty', 0.9, 'States with pending mining legislation', 'state', 'NY');

-- ============================================================================
-- INDEXES for common queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sites_company ON sites(company_id);
CREATE INDEX IF NOT EXISTS idx_sites_state ON sites(state);
CREATE INDEX IF NOT EXISTS idx_sites_status ON sites(status);
CREATE INDEX IF NOT EXISTS idx_subsites_site ON subsites(site_id);
CREATE INDEX IF NOT EXISTS idx_hardware_subsite ON hardware(subsite_id);
CREATE INDEX IF NOT EXISTS idx_news_company ON news(company_id);
CREATE INDEX IF NOT EXISTS idx_news_site ON news(site_id);
CREATE INDEX IF NOT EXISTS idx_news_status ON news(status);
CREATE INDEX IF NOT EXISTS idx_review_status ON review_queue(status);

-- ============================================================================
-- VIEWS for common rollups
-- ============================================================================

-- Site summary with rollup from subsites
CREATE VIEW IF NOT EXISTS v_site_summary AS
SELECT
    s.id,
    s.company_id,
    s.name,
    s.city,
    s.state,
    s.country,
    s.status,
    s.total_mw_capacity,
    s.power_cost_kwh,
    s.utility_provider,
    COALESCE(SUM(sub.mw_energized), 0) as total_mw_energized,
    COALESCE(SUM(sub.mw_contracted), 0) as total_mw_contracted,
    COALESCE(SUM(sub.hash_rate_eh), 0) as total_hash_rate_eh,
    COUNT(sub.id) as subsite_count,
    c.name as company_name
FROM sites s
LEFT JOIN subsites sub ON sub.site_id = s.id
LEFT JOIN companies c ON c.id = s.company_id
GROUP BY s.id;

-- Company summary with rollup from sites
CREATE VIEW IF NOT EXISTS v_company_summary AS
SELECT
    c.id,
    c.name,
    c.ticker,
    c.btc_holdings,
    c.hash_rate_eh,
    c.market_cap_usd,
    c.debt_usd,
    COUNT(DISTINCT s.id) as site_count,
    COALESCE(SUM(vs.total_mw_energized), 0) as total_mw_energized,
    COALESCE(SUM(vs.total_mw_contracted), 0) as total_mw_contracted,
    COALESCE(SUM(s.total_mw_capacity), 0) as total_mw_capacity
FROM companies c
LEFT JOIN sites s ON s.company_id = c.id
LEFT JOIN v_site_summary vs ON vs.id = s.id
GROUP BY c.id;
