// Valuation calculation helpers (client-side)

const Valuation = {
    settings: {},
    multipliers: [],

    // Load settings from API
    async loadSettings() {
        const data = await API.getSettings();
        this.settings = data.settings;
        this.multipliers = data.multipliers;
        return data;
    },

    // Calculate site valuation
    calculateSite(site) {
        const s = this.settings;
        let value = 0;

        // MW-based valuation
        const energized = (site.total_mw_energized || site.mw_energized || 0);
        const contracted = (site.total_mw_contracted || site.mw_contracted || 0);
        const capacity = site.total_mw_capacity || 0;

        const energizedValue = energized * parseFloat(s.mw_value_energized || 2000000);
        const contractedValue = (contracted - energized) * parseFloat(s.mw_value_contracted || 1000000);
        const plannedValue = (capacity - contracted) * parseFloat(s.mw_value_planned || 500000);

        value = energizedValue + contractedValue + plannedValue;

        // Status discount
        const discountMap = {
            operational: parseFloat(s.discount_operational || 1.0),
            under_construction: parseFloat(s.discount_under_construction || 0.6),
            planned: parseFloat(s.discount_planned || 0.3),
            curtailed: parseFloat(s.discount_curtailed || 0.5),
            closed: 0.1
        };
        value *= discountMap[site.status] || 1.0;

        // Power cost adjustment
        if (site.power_cost_kwh) {
            const cheapThreshold = parseFloat(s.power_tier_cheap_threshold || 0.03);
            const expensiveThreshold = parseFloat(s.power_tier_expensive_threshold || 0.06);
            const cheapMultiplier = parseFloat(s.power_tier_cheap_multiplier || 1.2);
            const expensiveMultiplier = parseFloat(s.power_tier_expensive_multiplier || 0.8);

            if (site.power_cost_kwh < cheapThreshold) {
                value *= cheapMultiplier;
            } else if (site.power_cost_kwh > expensiveThreshold) {
                value *= expensiveMultiplier;
            }
        }

        // Custom multipliers
        for (const m of this.multipliers) {
            if (!m.is_active) continue;
            if (m.scope === 'global' ||
                (m.scope === 'state' && m.scope_value === site.state) ||
                (m.scope === 'site' && parseInt(m.scope_value) === site.id)) {
                value *= m.multiplier;
            }
        }

        return {
            total: value,
            components: { energizedValue, contractedValue, plannedValue }
        };
    },

    // Calculate company valuation
    calculateCompany(company, sites) {
        const s = this.settings;

        // Sum site valuations
        let siteValue = 0;
        for (const site of sites) {
            siteValue += this.calculateSite(site).total;
        }

        // BTC holdings value
        const btcPrice = parseFloat(s.btc_price || 60000);
        const btcValue = (company.btc_holdings || 0) * btcPrice;

        // Hash rate value (informational, not added to total since it's reflected in sites)
        const hashRateValue = (company.hash_rate_eh || 0) * parseFloat(s.eh_value || 100000000);

        const total = siteValue + btcValue;
        const marketCap = company.market_cap_usd || 0;

        return {
            siteValue,
            btcValue,
            hashRateValue,
            total,
            marketCap,
            diff: total - marketCap,
            ratio: marketCap > 0 ? total / marketCap : null
        };
    },

    // Format valuation comparison
    formatComparison(valuation) {
        const { total, marketCap, diff, ratio } = valuation;
        const isUndervalued = diff > 0;

        return {
            total: Format.currency(total),
            marketCap: Format.currency(marketCap),
            diff: (isUndervalued ? '+' : '') + Format.currency(diff),
            ratio: ratio ? (ratio * 100).toFixed(0) + '%' : '-',
            isUndervalued,
            cssClass: isUndervalued ? 'val-positive' : 'val-negative'
        };
    }
};
