// Charts module using Chart.js

const Charts = {
    instances: {},

    // Color palette
    colors: {
        orange: 'rgb(249, 115, 22)',
        blue: 'rgb(59, 130, 246)',
        green: 'rgb(34, 197, 94)',
        yellow: 'rgb(234, 179, 8)',
        red: 'rgb(239, 68, 68)',
        purple: 'rgb(168, 85, 247)',
        gray: 'rgb(107, 114, 128)'
    },

    // Destroy existing chart instance
    destroy(id) {
        if (this.instances[id]) {
            this.instances[id].destroy();
            delete this.instances[id];
        }
    },

    // Common chart options for dark theme
    darkThemeOptions: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: '#9ca3af' }
            }
        },
        scales: {
            x: {
                ticks: { color: '#9ca3af' },
                grid: { color: '#374151' }
            },
            y: {
                ticks: { color: '#9ca3af' },
                grid: { color: '#374151' }
            }
        }
    },

    // Status distribution pie chart
    createStatusChart(canvasId, data) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const statusColors = {
            operational: this.colors.green,
            under_construction: this.colors.yellow,
            planned: this.colors.blue,
            curtailed: this.colors.orange,
            closed: this.colors.red
        };

        this.instances[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => Format.status(d.status)),
                datasets: [{
                    data: data.map(d => d.count),
                    backgroundColor: data.map(d => statusColors[d.status] || this.colors.gray),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#9ca3af', padding: 10 }
                    }
                }
            }
        });
    },

    // MW capacity by company bar chart
    createCapacityChart(canvasId, companies) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: companies.map(c => c.name),
                datasets: [
                    {
                        label: 'MW Energized',
                        data: companies.map(c => c.total_mw_energized || 0),
                        backgroundColor: this.colors.green
                    },
                    {
                        label: 'MW Contracted',
                        data: companies.map(c => (c.total_mw_contracted || 0) - (c.total_mw_energized || 0)),
                        backgroundColor: this.colors.yellow
                    },
                    {
                        label: 'MW Planned',
                        data: companies.map(c => (c.total_mw_capacity || 0) - (c.total_mw_contracted || 0)),
                        backgroundColor: this.colors.blue
                    }
                ]
            },
            options: {
                ...this.darkThemeOptions,
                scales: {
                    x: {
                        stacked: true,
                        ticks: { color: '#9ca3af' },
                        grid: { display: false }
                    },
                    y: {
                        stacked: true,
                        ticks: { color: '#9ca3af' },
                        grid: { color: '#374151' },
                        title: { display: true, text: 'MW', color: '#9ca3af' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#9ca3af' }
                    }
                }
            }
        });
    },

    // State distribution horizontal bar chart
    createStateChart(canvasId, data) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.state || 'Unknown'),
                datasets: [{
                    label: 'Sites',
                    data: data.map(d => d.count),
                    backgroundColor: this.colors.orange
                }]
            },
            options: {
                ...this.darkThemeOptions,
                indexAxis: 'y',
                scales: {
                    x: {
                        ticks: { color: '#9ca3af' },
                        grid: { color: '#374151' }
                    },
                    y: {
                        ticks: { color: '#9ca3af' },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    },

    // Valuation vs market cap comparison chart
    createValuationChart(canvasId, valuations) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: valuations.map(v => v.ticker || v.name),
                datasets: [
                    {
                        label: 'Valuation',
                        data: valuations.map(v => v.totalValuation / 1e9),
                        backgroundColor: this.colors.orange
                    },
                    {
                        label: 'Market Cap',
                        data: valuations.map(v => v.marketCap / 1e9),
                        backgroundColor: this.colors.blue
                    }
                ]
            },
            options: {
                ...this.darkThemeOptions,
                scales: {
                    x: {
                        ticks: { color: '#9ca3af' },
                        grid: { display: false }
                    },
                    y: {
                        ticks: {
                            color: '#9ca3af',
                            callback: (v) => '$' + v + 'B'
                        },
                        grid: { color: '#374151' },
                        title: { display: true, text: 'Billion USD', color: '#9ca3af' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#9ca3af' }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ctx.dataset.label + ': $' + ctx.raw.toFixed(2) + 'B'
                        }
                    }
                }
            }
        });
    },

    // Valuation breakdown pie chart for single company
    createValuationBreakdownChart(canvasId, valuation) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        this.instances[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Site Value', 'BTC Holdings'],
                datasets: [{
                    data: [valuation.siteValue, valuation.btcValue],
                    backgroundColor: [this.colors.orange, this.colors.yellow],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#9ca3af' }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ctx.label + ': ' + Format.currency(ctx.raw)
                        }
                    }
                }
            }
        });
    },

    // BTC holdings comparison
    createBtcHoldingsChart(canvasId, companies) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const sorted = [...companies].sort((a, b) => (b.btc_holdings || 0) - (a.btc_holdings || 0));

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(c => c.ticker || c.name),
                datasets: [{
                    label: 'BTC Holdings',
                    data: sorted.map(c => c.btc_holdings || 0),
                    backgroundColor: this.colors.yellow
                }]
            },
            options: {
                ...this.darkThemeOptions,
                scales: {
                    x: {
                        ticks: { color: '#9ca3af' },
                        grid: { display: false }
                    },
                    y: {
                        ticks: {
                            color: '#9ca3af',
                            callback: (v) => v.toLocaleString() + ' BTC'
                        },
                        grid: { color: '#374151' }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    },

    // Hash rate comparison
    createHashRateChart(canvasId, companies) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const sorted = [...companies].sort((a, b) => (b.hash_rate_eh || 0) - (a.hash_rate_eh || 0));

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(c => c.ticker || c.name),
                datasets: [{
                    label: 'Hash Rate (EH/s)',
                    data: sorted.map(c => c.hash_rate_eh || 0),
                    backgroundColor: this.colors.purple
                }]
            },
            options: {
                ...this.darkThemeOptions,
                scales: {
                    x: {
                        ticks: { color: '#9ca3af' },
                        grid: { display: false }
                    },
                    y: {
                        ticks: {
                            color: '#9ca3af',
                            callback: (v) => v + ' EH/s'
                        },
                        grid: { color: '#374151' }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    },

    // Power cost distribution
    createPowerCostChart(canvasId, sites) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const sitesWithPower = sites.filter(s => s.power_cost_kwh);
        const sorted = [...sitesWithPower].sort((a, b) => a.power_cost_kwh - b.power_cost_kwh);

        // Color based on cost tier
        const colors = sorted.map(s => {
            if (s.power_cost_kwh < 0.03) return this.colors.green;
            if (s.power_cost_kwh > 0.05) return this.colors.red;
            return this.colors.yellow;
        });

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(s => s.name.substring(0, 15)),
                datasets: [{
                    label: '$/kWh',
                    data: sorted.map(s => s.power_cost_kwh),
                    backgroundColor: colors
                }]
            },
            options: {
                ...this.darkThemeOptions,
                scales: {
                    x: {
                        ticks: { color: '#9ca3af', maxRotation: 45 },
                        grid: { display: false }
                    },
                    y: {
                        ticks: {
                            color: '#9ca3af',
                            callback: (v) => '$' + v.toFixed(3)
                        },
                        grid: { color: '#374151' }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
};
