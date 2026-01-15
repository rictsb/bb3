// Site Map Visualization using Leaflet.js

let siteMap = null;
let mapMarkers = [];

// Render map page
async function renderMap() {
    const app = document.getElementById('app');

    try {
        const sites = await API.getSites();
        const sitesWithCoords = sites.filter(s => s.latitude && s.longitude);

        app.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <h1 class="text-2xl font-bold">Site Map</h1>
                <div class="flex items-center space-x-2">
                    <select id="map-filter-status" onchange="filterMapMarkers()" class="filter-input">
                        <option value="">All Statuses</option>
                        <option value="operational">Operational</option>
                        <option value="under_construction">Under Construction</option>
                        <option value="planned">Planned</option>
                    </select>
                    <select id="map-filter-company" onchange="filterMapMarkers()" class="filter-input">
                        <option value="">All Companies</option>
                        ${companiesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                    <span class="text-sm text-gray-400">${sitesWithCoords.length} of ${sites.length} sites mapped</span>
                </div>
            </div>

            <div class="grid md:grid-cols-4 gap-4 mb-4">
                <div class="stat-card">
                    <div class="stat-value text-green-400">${sites.filter(s => s.status === 'operational').length}</div>
                    <div class="stat-label">Operational</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value text-yellow-400">${sites.filter(s => s.status === 'under_construction').length}</div>
                    <div class="stat-label">Under Construction</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value text-blue-400">${sites.filter(s => s.status === 'planned').length}</div>
                    <div class="stat-label">Planned</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Format.mw(sites.reduce((s, site) => s + (site.total_mw_capacity || 0), 0))}</div>
                    <div class="stat-label">Total Capacity</div>
                </div>
            </div>

            <div class="card" style="padding: 0; overflow: hidden;">
                <div id="site-map" style="height: 500px; width: 100%;"></div>
            </div>

            <div class="card mt-4">
                <div class="card-header">Sites Without Coordinates</div>
                ${sites.filter(s => !s.latitude || !s.longitude).length > 0 ? `
                    <div class="text-sm text-gray-400 space-y-1">
                        ${sites.filter(s => !s.latitude || !s.longitude).map(s => `
                            <div class="flex items-center justify-between py-1 border-b border-gray-700">
                                <span>${s.company_name} - ${s.name} (${s.city}, ${s.state})</span>
                                <button onclick="showSiteForm(${s.id})" class="btn btn-secondary btn-sm">Add Coords</button>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div class="text-gray-400">All sites have coordinates!</div>'}
            </div>
        `;

        // Initialize map after DOM is ready
        setTimeout(() => initMap(sitesWithCoords), 100);

    } catch (e) {
        app.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
    }
}

// Initialize Leaflet map
function initMap(sites) {
    // Destroy existing map if any
    if (siteMap) {
        siteMap.remove();
        siteMap = null;
    }
    mapMarkers = [];

    const mapContainer = document.getElementById('site-map');
    if (!mapContainer) return;

    // Create map centered on US
    siteMap = L.map('site-map', {
        center: [39.8283, -98.5795],
        zoom: 4,
        scrollWheelZoom: true
    });

    // Add dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(siteMap);

    // Add markers
    addMapMarkers(sites);

    // Fit bounds if we have sites
    if (sites.length > 0) {
        const bounds = L.latLngBounds(sites.map(s => [s.latitude, s.longitude]));
        siteMap.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Add markers to map
function addMapMarkers(sites) {
    // Clear existing markers
    mapMarkers.forEach(m => siteMap.removeLayer(m));
    mapMarkers = [];

    const statusColors = {
        operational: '#22c55e',
        under_construction: '#eab308',
        planned: '#3b82f6',
        curtailed: '#f97316',
        closed: '#ef4444'
    };

    sites.forEach(site => {
        const color = statusColors[site.status] || '#6b7280';
        const size = Math.max(10, Math.min(30, (site.total_mw_capacity || 50) / 30));

        // Create custom circle marker
        const marker = L.circleMarker([site.latitude, site.longitude], {
            radius: size,
            fillColor: color,
            color: '#1f2937',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        // Popup content
        const popup = `
            <div style="min-width: 200px; color: #1f2937;">
                <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${site.name}</div>
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${site.company_name}</div>
                <table style="font-size: 12px; width: 100%;">
                    <tr><td style="color: #6b7280;">Location:</td><td>${site.city}, ${site.state}</td></tr>
                    <tr><td style="color: #6b7280;">Status:</td><td><span style="color: ${color}; font-weight: 500;">${Format.status(site.status)}</span></td></tr>
                    <tr><td style="color: #6b7280;">Capacity:</td><td>${Format.mw(site.total_mw_capacity)}</td></tr>
                    <tr><td style="color: #6b7280;">Energized:</td><td>${Format.mw(site.total_mw_energized)}</td></tr>
                    ${site.power_cost_kwh ? `<tr><td style="color: #6b7280;">Power Cost:</td><td>$${site.power_cost_kwh}/kWh</td></tr>` : ''}
                </table>
                <div style="margin-top: 8px;">
                    <a href="#" onclick="navigate('site', {id: ${site.id}}); return false;"
                       style="color: #f97316; text-decoration: none; font-size: 12px;">
                        View Details →
                    </a>
                </div>
            </div>
        `;

        marker.bindPopup(popup);
        marker.siteData = site; // Store site data for filtering
        marker.addTo(siteMap);
        mapMarkers.push(marker);
    });
}

// Filter map markers
async function filterMapMarkers() {
    const statusFilter = document.getElementById('map-filter-status').value;
    const companyFilter = document.getElementById('map-filter-company').value;

    const sites = await API.getSites();
    let filtered = sites.filter(s => s.latitude && s.longitude);

    if (statusFilter) {
        filtered = filtered.filter(s => s.status === statusFilter);
    }
    if (companyFilter) {
        filtered = filtered.filter(s => s.company_id === parseInt(companyFilter));
    }

    addMapMarkers(filtered);

    // Update bounds if we have sites
    if (filtered.length > 0) {
        const bounds = L.latLngBounds(filtered.map(s => [s.latitude, s.longitude]));
        siteMap.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Focus map on specific site
function focusMapOnSite(siteId) {
    const marker = mapMarkers.find(m => m.siteData && m.siteData.id === siteId);
    if (marker && siteMap) {
        siteMap.setView(marker.getLatLng(), 10);
        marker.openPopup();
    }
}
