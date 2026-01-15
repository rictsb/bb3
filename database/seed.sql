-- Sample data for Bitcoin Mining Tracker
-- Run after schema.sql

-- Sample Companies
INSERT OR IGNORE INTO companies (id, name, ticker, website, btc_holdings, hash_rate_eh, market_cap_usd, debt_usd, notes) VALUES
(1, 'Marathon Digital', 'MARA', 'https://marathondh.com', 26842, 33.5, 6200000000, 850000000, 'Largest publicly traded Bitcoin miner by market cap'),
(2, 'Riot Platforms', 'RIOT', 'https://riotplatforms.com', 17722, 28.0, 3800000000, 0, 'Zero long-term debt, large Texas operations'),
(3, 'CleanSpark', 'CLSK', 'https://cleanspark.com', 9952, 24.0, 2400000000, 50000000, 'Focus on sustainable mining'),
(4, 'Bitfarms', 'BITF', 'https://bitfarms.com', 905, 11.0, 800000000, 120000000, 'Operations in Canada, US, Paraguay'),
(5, 'Cipher Mining', 'CIFR', 'https://ciphermining.com', 1034, 8.5, 1200000000, 0, 'Texas-focused operations');

-- Sample Sites (with coordinates)
INSERT OR IGNORE INTO sites (id, company_id, name, city, state, country, latitude, longitude, total_mw_capacity, land_acres, status, utility_provider, power_cost_kwh, power_source, notes) VALUES
-- Marathon Sites
(1, 1, 'Ellendale Facility', 'Ellendale', 'ND', 'USA', 46.0022, -98.5267, 180, 40, 'operational', 'Basin Electric', 0.028, 'Wind/Grid', 'Joint venture with Applied Digital'),
(2, 1, 'Garden City', 'Garden City', 'TX', 'USA', 31.8610, -101.4876, 200, 100, 'operational', 'ERCOT', 0.032, 'Grid', 'Acquired from Compute North'),
(3, 1, 'Granbury Facility', 'Granbury', 'TX', 'USA', 32.4418, -97.7942, 280, 150, 'under_construction', 'ERCOT', 0.035, 'Grid', 'Expansion underway'),

-- Riot Sites
(4, 2, 'Rockdale Facility', 'Rockdale', 'TX', 'USA', 30.6554, -97.0017, 750, 265, 'operational', 'ERCOT', 0.025, 'Grid', 'Largest Bitcoin mining facility in North America'),
(5, 2, 'Corsicana Facility', 'Corsicana', 'TX', 'USA', 32.0954, -96.4689, 1000, 500, 'under_construction', 'ERCOT', 0.030, 'Grid', 'Will be largest facility when complete'),

-- CleanSpark Sites
(6, 3, 'Sandersville', 'Sandersville', 'GA', 'USA', 32.9818, -82.8101, 100, 30, 'operational', 'Georgia Power', 0.042, 'Grid', 'Southeast hub'),
(7, 3, 'Dalton Campus', 'Dalton', 'GA', 'USA', 34.7698, -84.9702, 75, 25, 'operational', 'Georgia Power', 0.040, 'Grid', NULL),
(8, 3, 'Norcross Facility', 'Norcross', 'GA', 'USA', 33.9412, -84.2135, 50, 15, 'operational', 'Georgia Power', 0.045, 'Grid', NULL),
(9, 3, 'Cheyenne WY', 'Cheyenne', 'WY', 'USA', 41.1400, -104.8197, 145, 60, 'planned', 'Black Hills Energy', 0.038, 'Wind/Grid', 'Announced Q2 2024'),

-- Bitfarms Sites
(10, 4, 'Sherbrooke', 'Sherbrooke', 'QC', 'Canada', 45.4010, -71.8929, 69, 20, 'operational', 'Hydro-Quebec', 0.025, 'Hydro', 'Original flagship facility'),
(11, 4, 'Sharon PA', 'Sharon', 'PA', 'USA', 41.2334, -80.5006, 120, 50, 'under_construction', 'FirstEnergy', 0.055, 'Grid', 'Former steel mill site'),

-- Cipher Sites
(12, 5, 'Odessa', 'Odessa', 'TX', 'USA', 31.8457, -102.3676, 200, 80, 'operational', 'ERCOT', 0.029, 'Grid', 'Primary facility'),
(13, 5, 'Black Pearl', 'Midland', 'TX', 'USA', 31.9973, -102.0779, 300, 120, 'under_construction', 'ERCOT', 0.032, 'Grid', 'Major expansion');

-- Sample Subsites/Phases
INSERT OR IGNORE INTO subsites (id, site_id, name, mw_contracted, mw_energized, hash_rate_eh, status, energization_date, notes) VALUES
-- Ellendale phases
(1, 1, 'Phase 1', 100, 100, 3.2, 'operational', '2023-06-15', 'Initial deployment'),
(2, 1, 'Phase 2', 80, 60, 1.8, 'operational', '2024-01-20', 'Expansion'),

-- Rockdale phases
(3, 4, 'Building A', 200, 200, 7.0, 'operational', '2022-03-01', 'Original building'),
(4, 4, 'Building B', 200, 200, 7.0, 'operational', '2022-09-15', NULL),
(5, 4, 'Building C', 200, 180, 6.0, 'operational', '2023-04-01', NULL),
(6, 4, 'Building D', 150, 100, 3.5, 'operational', '2023-11-01', 'Immersion cooling'),

-- Corsicana phases
(7, 5, 'Phase 1', 400, 200, 6.5, 'under_construction', '2024-06-01', 'First phase energized'),
(8, 5, 'Phase 2', 300, 0, 0, 'planned', NULL, 'Q4 2024 target'),
(9, 5, 'Phase 3', 300, 0, 0, 'planned', NULL, '2025 target'),

-- CleanSpark Sandersville
(10, 6, 'Main Building', 100, 95, 3.1, 'operational', '2023-02-01', NULL),

-- Cipher Odessa
(11, 12, 'Phase 1', 150, 150, 5.0, 'operational', '2023-01-15', NULL),
(12, 12, 'Phase 2', 50, 40, 1.3, 'operational', '2023-08-01', NULL);

-- Sample Hardware
INSERT OR IGNORE INTO hardware (id, subsite_id, model, manufacturer, quantity, hash_rate_th_each, power_watts_each, status, deployment_date) VALUES
(1, 1, 'Antminer S19 XP', 'Bitmain', 3200, 140, 3010, 'deployed', '2023-06-15'),
(2, 3, 'Antminer S19j Pro', 'Bitmain', 7000, 104, 3068, 'deployed', '2022-03-01'),
(3, 4, 'Antminer S19 Pro', 'Bitmain', 7000, 110, 3250, 'deployed', '2022-09-15'),
(4, 7, 'Antminer S21', 'Bitmain', 5000, 200, 3500, 'deployed', '2024-06-01'),
(5, 11, 'Whatsminer M50S', 'MicroBT', 4500, 126, 3276, 'deployed', '2023-01-15');

-- Sample News
INSERT OR IGNORE INTO news (id, company_id, site_id, title, source, publish_date, summary, status) VALUES
(1, 2, 5, 'Riot Platforms Corsicana Facility Reaches 400 MW Milestone', 'Company PR', '2024-06-15', 'Riot announced the first phase of its Corsicana facility is now operational with 400 MW of capacity.', 'approved'),
(2, 1, NULL, 'Marathon Digital Q1 2024 Production Update', 'SEC 8-K', '2024-04-10', 'Marathon produced 2,811 BTC in Q1 2024, up 28% year-over-year.', 'approved'),
(3, 3, NULL, 'CleanSpark Announces Wyoming Expansion Plans', 'Company PR', '2024-05-20', 'CleanSpark to develop 145 MW facility in Cheyenne, Wyoming with focus on renewable energy integration.', 'pending');
