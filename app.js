/**
 * ============================================================================
 * BRADEN GLOBE GIS OBSERVATORY
 * Application Logic & Local Server Data Architecture
 * 
 * Local Data Directories:
 * - Events Timeline:   /public/data/events.json        -> fetch('/data/events.json')
 * - Hourly Wind Frames: /public/data/wind/wind_*.json   -> fetch('/data/wind/wind_YYYYMMDD_HH00.json')
 * - Local SVG Tiles:   /public/tiles/basemap/{z}/{x}/{y}.svg
 * ============================================================================
 */

import LeafletModule from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ensure L is safely resolved from window.L or ESM module
const L = window.L || LeafletModule.default || LeafletModule;
window.L = L;

/* ============================================================================
   1. CONFIGURATION & CONSTANTS
   ============================================================================ */

const DATA_CONFIG = {
  // Local event chronology endpoint
  eventsUrl: `${import.meta.env.BASE_URL}data/events.json`,
  
  // Local hourly wind vector files
  windBaseDir: `${import.meta.env.BASE_URL}data/wind`,
  baseDate: '20261005', // YYYYMMDD
  
  tilePath: `${import.meta.env.BASE_URL}tiles/basemap`
};

const BASEMAPS = {
  svg: {
    name: 'SVG Shape Map',
    attribution: 'Land boundaries: Natural Earth, public domain'
  },
  'blue-marble': {
    name: 'Blue Marble',
    url: `${import.meta.env.BASE_URL}tiles/blue-marble/{z}/{x}/{y}.jpg`,
    attribution: 'Imagery provided by NASA GIBS / ESDIS'
  },
  political: {
    name: 'Country Boundaries',
    attribution: 'Country boundaries: Natural Earth, public domain'
  }
};

function loadMapColor(key, fallback) {
  const color = localStorage.getItem(key);
  return /^#[\da-f]{6}$/i.test(color || '') ? color.toLowerCase() : fallback;
}

function loadBasemap() {
  const basemap = localStorage.getItem('terra_basemap');
  return Object.hasOwn(BASEMAPS, basemap) ? basemap : 'svg';
}

// Event visual anchors: color tokens matching user specifications
const EVENT_THEMES = {
  volcano: {
    color: '#EF4444', // Crimson for Volcanoes
    label: 'Volcano',
    iconSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m2 20 8-16 4 8 4-4 4 12H2Z"/></svg>`
  },
  rocket: {
    color: '#06B6D4', // Cyan for Rocket Launches
    label: 'Rocket Launch',
    iconSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>`
  },
  bolide: {
    color: '#F59E0B', // Gold for Bolides
    label: 'Bolide Airburst',
    iconSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
  }
};

/* ============================================================================
   2. APPLICATION STATE
   ============================================================================ */

const state = {
  basemap: loadBasemap(),
  landColor: loadMapColor('terra_land_color', '#18352f'),
  seaColor: loadMapColor('terra_sea_color', '#070b13'),
  
  // Scrubber & playback
  currentHour: 10,       // 00 to 23
  isPlaying: false,      // transport play/pause state
  playbackInterval: null,// timer id
  playbackSpeedMs: 800,  // ms per hour frame
  
  // Event tracking cache
  events: [],
  selectedEventId: null,
  activeFilterType: 'all', // 'all' | 'volcano' | 'rocket' | 'bolide'
  searchQuery: '',
  
  // Current wind data frame (normalized)
  currentWindData: null,
  pendingUploadedWind: null,
  
  // Layer visibility toggles
  showWindVectors: true,
  showStreamlines: true,
  showEvents: true,
  
  // Leaflet map references
  map: null,
  activeBaseTileLayer: null,
  eventMarkersLayerGroup: null,
  windVectorsLayerGroup: null,
  
  // Canvas streamline animation
  streamlineCanvas: null,
  streamlineCtx: null,
  animationFrameId: null,
  particles: []
};

/* ============================================================================
   3. DOM ELEMENT REFERENCES
   ============================================================================ */

const dom = {
  mapContainer: document.getElementById('map'),
  streamlineCanvas: document.getElementById('wind-streamline-canvas'),
  
  // Telemetry HUD
  cursorLat: document.getElementById('cursor-lat'),
  cursorLng: document.getElementById('cursor-lng'),
  
  landColorInput: document.getElementById('land-color'),
  seaColorInput: document.getElementById('sea-color'),
  basemapOptions: document.querySelectorAll('[data-basemap]'),
  svgColorControls: document.getElementById('svg-color-controls'),
  
  // Sidebar Controls
  sidebar: document.getElementById('event-sidebar'),
  btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
  mapControlsHud: document.getElementById('map-controls-hud'),
  btnToggleMapControls: document.getElementById('btn-toggle-map-controls'),
  timeScrubberTray: document.getElementById('time-scrubber-tray'),
  btnToggleTimeline: document.getElementById('btn-toggle-timeline'),
  btnRecenter: document.getElementById('btn-recenter'),
  eventsList: document.getElementById('events-list'),
  eventSearchInput: document.getElementById('event-search-input'),
  eventTotalCount: document.getElementById('event-total-count'),
  filterTabs: document.querySelectorAll('.filter-tab'),
  countAll: document.getElementById('count-all'),
  countVolcano: document.getElementById('count-volcano'),
  countRocket: document.getElementById('count-rocket'),
  countBolide: document.getElementById('count-bolide'),
  sidebarFilterLabel: document.getElementById('sidebar-active-filter-label'),
  
  // Layer Toggles
  toggleWindVectors: document.getElementById('toggle-wind-vectors'),
  toggleWindStreamlines: document.getElementById('toggle-wind-streamlines'),
  toggleEvents: document.getElementById('toggle-events'),
  
  // Atmospheric Vector Probe HUD
  vectorProbeHud: document.getElementById('vector-probe-hud'),
  probeCoords: document.getElementById('probe-coords'),
  probeU: document.getElementById('probe-u'),
  probeV: document.getElementById('probe-v'),
  probeSpeed: document.getElementById('probe-speed'),
  probeHeading: document.getElementById('probe-heading'),
  
  // Time Scrubber & Transport
  btnPlayPause: document.getElementById('btn-play-pause'),
  iconPlay: document.getElementById('icon-play'),
  iconPause: document.getElementById('icon-pause'),
  btnStepPrev: document.getElementById('btn-step-prev'),
  btnStepNext: document.getElementById('btn-step-next'),
  selectSpeed: document.getElementById('select-speed'),
  scrubberTimeText: document.getElementById('scrubber-time-text'),
  scrubberRelativeText: document.getElementById('scrubber-relative-text'),
  activeFileIndicator: document.getElementById('active-file-indicator'),
  timeSlider: document.getElementById('time-slider'),
  timelineTicksContainer: document.getElementById('timeline-ticks-container'),
  
  // Modals & Triggers
  btnOpenNetcdfModal: document.getElementById('btn-open-netcdf-modal'),
  btnCloseNetcdfModal: document.getElementById('btn-close-netcdf-modal'),
  modalNetcdf: document.getElementById('modal-netcdf'),
  netcdfDropzone: document.getElementById('netcdf-dropzone'),
  netcdfFileInput: document.getElementById('netcdf-file-input'),
  uploadInspectPanel: document.getElementById('upload-inspect-panel'),
  inspectTimestamp: document.getElementById('inspect-timestamp'),
  inspectVars: document.getElementById('inspect-vars'),
  inspectPoints: document.getElementById('inspect-points'),
  inspectGrid: document.getElementById('inspect-grid'),
  inspectMaxSpeed: document.getElementById('inspect-max-speed'),
  btnApplyUploadedWind: document.getElementById('btn-apply-uploaded-wind'),
  btnCopyScript: document.getElementById('btn-copy-script'),
  
  // Feedback Toast
  toast: document.getElementById('gis-toast'),
  toastMsg: document.getElementById('gis-toast-msg')
};

/* ============================================================================
   4. UTILITY HELPERS
   ============================================================================ */

function pad2(num) {
  return String(num).padStart(2, '0');
}

function formatCoord(val, isLat) {
  const abs = Math.abs(val).toFixed(2);
  const dir = isLat ? (val >= 0 ? '°N' : '°S') : (val >= 0 ? '°E' : '°W');
  return `${abs}${dir}`;
}

function showToast(message, duration = 3200) {
  if (!dom.toast) return;
  dom.toastMsg.textContent = message;
  dom.toast.classList.add('visible');
  clearTimeout(dom.toast._timeout);
  dom.toast._timeout = setTimeout(() => {
    dom.toast.classList.remove('visible');
  }, duration);
}

function getWindColor(speed) {
  if (speed < 5) return '#38bdf8';  // Light sky blue
  if (speed < 12) return '#06b6d4'; // Cyan
  if (speed < 20) return '#10b981'; // Emerald
  if (speed < 30) return '#eab308'; // Amber
  if (speed < 42) return '#f97316'; // Orange
  return '#ef4444';                 // Crimson
}

function degreesToCompass(deg) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
}

/* ============================================================================
   5. NETCDF PYTHON PARSER & FLEXIBLE INGESTION
   ============================================================================ */

/**
 * Normalizes an individual vector record:
 * - Detects lat/lng or latitude/longitude
 * - Normalizes longitude from [0, 360] to [-180, 180]
 * - Auto-computes speed = sqrt(u^2 + v^2) and meteorological heading if missing
 */
function normalizeVector(v) {
  if (!v) return null;

  let lat = typeof v.lat === 'number' ? v.lat : parseFloat(v.lat || v.latitude || 0);
  let lng = typeof v.lng === 'number' ? v.lng : (typeof v.lon === 'number' ? v.lon : parseFloat(v.lng || v.lon || v.longitude || 0));

  // Normalize longitude if 0..360
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;

  // Detect u and v components
  let u = typeof v.u === 'number' ? v.u : parseFloat(v.u || v.u10 || v.UGRD || v.u_wind || v.eastward_wind || 0);
  let vComp = typeof v.v === 'number' ? v.v : parseFloat(v.v || v.v10 || v.VGRD || v.v_wind || v.northward_wind || 0);

  if (isNaN(lat) || isNaN(lng) || isNaN(u) || isNaN(vComp)) return null;

  // Auto-calculate magnitude and direction if not provided
  let speed = typeof v.speed === 'number' ? v.speed : parseFloat(v.speed || v.ws || Math.sqrt(u * u + vComp * vComp));
  let direction = typeof v.direction === 'number' ? v.direction : parseFloat(v.direction || v.heading || ((Math.atan2(-u, -vComp) * 180 / Math.PI + 360) % 360));

  return {
    lat: Math.round(lat * 1000) / 1000,
    lng: Math.round(lng * 1000) / 1000,
    u: Math.round(u * 100) / 100,
    v: Math.round(vComp * 100) / 100,
    speed: Math.round(speed * 100) / 100,
    direction: Math.round(direction * 10) / 10
  };
}

/**
 * Flexible Parser that accommodates:
 * - xarray.Dataset.to_dict() JSON exports
 * - 2D grid matrix objects ({ lat: [...], lon: [...], u: [[...]], v: [[...]] })
 * - GeoJSON vector LineString/Point FeatureCollections
 * - Flat list of vector objects ({ vectors: [...] } or [ { lat, lon, u, v } ])
 */
function parseWindDataset(rawJson) {
  if (!rawJson) return null;

  let vectors = [];
  let detectedVars = 'u, v';
  let timestamp = rawJson.timestamp || (rawJson.time ? String(rawJson.time) : new Date().toISOString());

  // 1. Direct vectors array
  if (Array.isArray(rawJson.vectors)) {
    vectors = rawJson.vectors.map(v => normalizeVector(v)).filter(Boolean);
  }
  // 2. Direct array of objects
  else if (Array.isArray(rawJson)) {
    vectors = rawJson.map(v => normalizeVector(v)).filter(Boolean);
  }
  // 3. GeoJSON FeatureCollection
  else if (rawJson.type === 'FeatureCollection' && Array.isArray(rawJson.features)) {
    vectors = rawJson.features.map(f => {
      const props = f.properties || {};
      const coords = f.geometry && f.geometry.coordinates ? f.geometry.coordinates : [0, 0];
      const [lng, lat] = Array.isArray(coords[0]) ? coords[0] : coords;
      return normalizeVector({ lat, lng, ...props });
    }).filter(Boolean);
  }
  // 4. xarray.Dataset.to_dict() or matrix coordinates
  else {
    const coords = rawJson.coords || rawJson;
    const dataVars = rawJson.data_vars || rawJson.variables || rawJson;

    // Detect latitude array
    const latObj = coords.latitude || coords.lat || coords.y;
    const lats = latObj && latObj.data ? latObj.data : (Array.isArray(latObj) ? latObj : null);

    // Detect longitude array
    const lonObj = coords.longitude || coords.lon || coords.x;
    const lons = lonObj && lonObj.data ? lonObj.data : (Array.isArray(lonObj) ? lonObj : null);

    // Detect U component
    const uKey = ['u10', 'u', 'UGRD', 'u_wind', 'eastward_wind', 'U10M'].find(k => dataVars && dataVars[k]);
    const uObj = uKey ? dataVars[uKey] : null;
    const uArr = uObj && uObj.data ? uObj.data : (Array.isArray(uObj) ? uObj : null);

    // Detect V component
    const vKey = ['v10', 'v', 'VGRD', 'v_wind', 'northward_wind', 'V10M'].find(k => dataVars && dataVars[k]);
    const vObj = vKey ? dataVars[vKey] : null;
    const vArr = vObj && vObj.data ? vObj.data : (Array.isArray(vObj) ? vObj : null);

    if (uKey && vKey) detectedVars = `${uKey}, ${vKey}`;

    if (lats && lons && uArr && vArr) {
      for (let i = 0; i < lats.length; i++) {
        const lat = lats[i];
        const uRow = uArr[i];
        const vRow = vArr[i];
        if (!uRow || !vRow) continue;

        for (let j = 0; j < lons.length; j++) {
          const lon = lons[j];
          const uVal = typeof uRow[j] === 'number' ? uRow[j] : parseFloat(uRow[j]);
          const vVal = typeof vRow[j] === 'number' ? vRow[j] : parseFloat(vRow[j]);

          if (isNaN(uVal) || isNaN(vVal)) continue;
          const nv = normalizeVector({ lat, lng: lon, u: uVal, v: vVal });
          if (nv) vectors.push(nv);
        }
      }
    }
  }

  if (vectors.length === 0) {
    throw new Error('No valid wind vector coordinates (lat, lon, u, v) could be extracted.');
  }

  // Calculate summary stats
  let maxSpeed = 0;
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  vectors.forEach(v => {
    if (v.speed > maxSpeed) maxSpeed = v.speed;
    if (v.lat < minLat) minLat = v.lat;
    if (v.lat > maxLat) maxLat = v.lat;
    if (v.lng < minLng) minLng = v.lng;
    if (v.lng > maxLng) maxLng = v.lng;
  });

  return {
    timestamp,
    vectors,
    summary: {
      totalPoints: vectors.length,
      detectedVars,
      maxSpeed: maxSpeed.toFixed(1),
      bounds: `${minLat.toFixed(1)}° to ${maxLat.toFixed(1)}° Lat, ${minLng.toFixed(1)}° to ${maxLng.toFixed(1)}° Lng`
    }
  };
}

/* ============================================================================
   6. LOCAL SVG TILE STORAGE & RENDERING
   ============================================================================ */

const LocalSvgTileLayer = L.GridLayer.extend({
  createTile(coords, done) {
    const tile = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tile.setAttribute('viewBox', '0 0 256 256');
    const tilePath = state.basemap === 'political'
      ? `${DATA_CONFIG.tilePath}/political/${coords.z}/${coords.x}/${coords.y}.svg`
      : `${DATA_CONFIG.tilePath}/${coords.z}/${coords.x}/${coords.y}.svg`;

    fetch(tilePath)
      .then((response) => {
        if (!response.ok) throw new Error(`Local SVG tile ${tilePath} returned HTTP ${response.status}`);
        return response.text();
      })
      .then((svg) => {
        const parsedTile = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const use = parsedTile.querySelector('use');
        if (!use) throw new Error(`Local SVG tile ${tilePath} is missing its map geometry`);
        const geometryFile = state.basemap === 'political' ? 'world-countries.svg#countries' : 'world.svg#land';
        use.setAttribute('href', `${import.meta.env.BASE_URL}tiles/basemap/${geometryFile}`);
        if (state.basemap === 'svg') {
          use.setAttribute('fill', state.landColor);
        }
        tile.appendChild(document.importNode(use, true));
        done(null, tile);
      })
      .catch((error) => {
        console.error('Failed to load local basemap tile:', error);
        done(error, tile);
      });

    return tile;
  }
});

function applyBaseTileLayer() {
  if (!state.map) return;

  if (state.activeBaseTileLayer) {
    state.map.removeLayer(state.activeBaseTileLayer);
  }

  const basemap = BASEMAPS[state.basemap];
  state.map.getContainer().style.backgroundColor = state.seaColor;
  if (dom.svgColorControls) dom.svgColorControls.hidden = state.basemap !== 'svg';

  if (state.basemap === 'blue-marble') {
    state.activeBaseTileLayer = L.tileLayer(basemap.url, {
      minZoom: 0,
      maxNativeZoom: 3,
      maxZoom: 14,
      attribution: basemap.attribution
    });
  } else {
    state.activeBaseTileLayer = new LocalSvgTileLayer({
      minZoom: 0,
      maxZoom: 14,
      maxNativeZoom: 5,
      tileSize: 256,
      attribution: basemap.attribution
    });
  }

  state.activeBaseTileLayer.addTo(state.map);
  updateBasemapSelector();
}

function updateBasemapSelector() {
  dom.basemapOptions.forEach((button) => {
    const isActive = button.dataset.basemap === state.basemap;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function selectBasemap(basemap) {
  if (!Object.hasOwn(BASEMAPS, basemap)) {
    console.error(`Unknown local basemap: ${basemap}`);
    showToast('Could not select the requested map layer.');
    return;
  }

  state.basemap = basemap;
  try {
    localStorage.setItem('terra_basemap', basemap);
  } catch (error) {
    console.error('Could not save map layer preference:', error);
    showToast('Map layer changed, but could not be saved in browser storage.');
  }
  applyBaseTileLayer();
}

function saveMapColor(input, storageKey, mapKey) {
  const color = input.value;
  if (!/^#[\da-f]{6}$/i.test(color)) {
    showToast('Choose a valid six-digit color.');
    return;
  }

  state[mapKey] = color.toLowerCase();
  try {
    localStorage.setItem(storageKey, state[mapKey]);
  } catch (error) {
    console.error('Could not save map color preference:', error);
    showToast('Color updated, but could not be saved in browser storage.');
  }
  applyBaseTileLayer();
}

/* ============================================================================
   7. MAP INITIALIZATION
   ============================================================================ */

function initMap() {
  state.map = L.map('map', {
    center: [20, 0],
    zoom: 2.5,
    minZoom: 1.5,
    maxZoom: 14,
    zoomControl: false,
    attributionControl: true,
    worldCopyJump: true
  });

  L.control.zoom({ position: 'topleft' }).addTo(state.map);

  state.eventMarkersLayerGroup = L.layerGroup().addTo(state.map);
  state.windVectorsLayerGroup = L.layerGroup().addTo(state.map);

  state.map.attributionControl.setPrefix(false);
  applyBaseTileLayer();

  state.map.on('mousemove', (e) => {
    if (dom.cursorLat && dom.cursorLng) {
      dom.cursorLat.textContent = formatCoord(e.latlng.lat, true);
      dom.cursorLng.textContent = formatCoord(e.latlng.lng, false);
    }
  });

  state.map.on('click', () => {
    if (dom.vectorProbeHud) {
      dom.vectorProbeHud.style.display = 'none';
    }
  });

  state.map.on('move resize zoom', () => {
    resizeStreamlineCanvas();
  });

  // Watch map container size and continuously update Leaflet to prevent grey/empty tiles
  if (window.ResizeObserver && dom.mapContainer) {
    const ro = new ResizeObserver(() => {
      if (state.map) {
        state.map.invalidateSize();
        resizeStreamlineCanvas();
      }
    });
    ro.observe(dom.mapContainer);
  }

  // Multi-stage size invalidation ensuring rendering in iframes / flex layouts
  [50, 150, 400, 1000].forEach(delay => {
    setTimeout(() => {
      if (state.map) {
        state.map.invalidateSize();
      }
    }, delay);
  });
}

/* ============================================================================
   8. DATA FETCHING: EVENTS & HOURLY WIND FRAMES
   ============================================================================ */

async function loadEventsData() {
  try {
    const res = await fetch(DATA_CONFIG.eventsUrl);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    state.events = await res.json();

    updateEventCounts();
    renderEventSidebar();
    renderEventMarkers();
    buildTimelineTicks();
  } catch (err) {
    console.error('Failed to load local events data:', err);
    showToast(`Error loading events: ${err.message}`);
  }
}

function getWindFilePath(hourIndex) {
  const padHour = pad2(hourIndex);
  return `${DATA_CONFIG.windBaseDir}/wind_${DATA_CONFIG.baseDate}_${padHour}00.json`;
}

async function loadWindDataForHour(hourIndex) {
  const filePath = getWindFilePath(hourIndex);
  
  if (dom.activeFileIndicator) {
    dom.activeFileIndicator.textContent = filePath;
  }
  
  try {
    const res = await fetch(filePath);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    
    const rawJson = await res.json();
    state.currentWindData = parseWindDataset(rawJson);
    
    renderWindVectors();
    initStreamlineParticles();
  } catch (err) {
    console.error(`Failed to load wind frame for hour ${hourIndex}:`, err);
    showToast(`Notice: Local wind file not found at ${filePath}`);
  }
}

/* ============================================================================
   9. EVENT TRACKER: SIDEBAR & MARKERS
   ============================================================================ */

function renderEventMarkers() {
  state.eventMarkersLayerGroup.clearLayers();
  if (!state.showEvents) return;

  state.events.forEach(evt => {
    if (state.activeFilterType !== 'all' && evt.type !== state.activeFilterType) {
      return;
    }

    const theme = EVENT_THEMES[evt.type] || EVENT_THEMES.bolide;
    const isSelected = state.selectedEventId === evt.id;

    const markerHtml = `
      <div class="custom-event-pin ${isSelected ? 'selected' : ''}" data-event-id="${evt.id}">
        <div class="event-pulse-ring ${evt.type}"></div>
        <div class="event-anchor-dot ${evt.type}"></div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'leaflet-event-div-icon',
      html: markerHtml,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });

    const marker = L.marker(evt.coordinates, { icon });

    const popupContent = `
      <div class="leaflet-gis-popup">
        <div class="popup-category-kicker" style="color: ${theme.color};">
          ${theme.iconSvg}
          <span>${theme.label}</span>
        </div>
        <h4 class="popup-title">${evt.name || evt.id}</h4>
        <p class="popup-desc">${evt.description}</p>
        <table class="popup-stats-table">
          <tr><td class="stat-label">TIMESTAMP</td><td class="stat-val">${evt.timestamp.replace('T', ' ').replace('Z', ' UTC')}</td></tr>
          <tr><td class="stat-label">COORDINATES</td><td class="stat-val">${formatCoord(evt.coordinates[0], true)}, ${formatCoord(evt.coordinates[1], false)}</td></tr>
          <tr><td class="stat-label">INTENSITY</td><td class="stat-val">${evt.magnitude || 'N/A'}</td></tr>
          <tr><td class="stat-label">STATUS</td><td class="stat-val">${evt.status || 'Active'}</td></tr>
        </table>
      </div>
    `;

    marker.bindPopup(popupContent, { maxWidth: 320 });
    marker.on('click', () => selectEvent(evt.id, false));
    marker.addTo(state.eventMarkersLayerGroup);
    
    evt._marker = marker;
  });
}

function renderEventSidebar() {
  if (!dom.eventsList) return;
  dom.eventsList.innerHTML = '';

  const query = state.searchQuery.toLowerCase().trim();

  const filteredEvents = state.events.filter(evt => {
    const matchesType = state.activeFilterType === 'all' || evt.type === state.activeFilterType;
    if (!matchesType) return false;
    
    if (!query) return true;
    const corpus = `${evt.name} ${evt.type} ${evt.description} ${evt.source || ''}`.toLowerCase();
    return corpus.includes(query);
  });

  if (filteredEvents.length === 0) {
    dom.eventsList.innerHTML = `
      <div style="padding: 24px 12px; text-align: center; color: var(--text-dim); font-family: var(--font-mono); font-size: 11px;">
        No events match current filter criteria.
      </div>
    `;
    return;
  }

  filteredEvents.forEach(evt => {
    const theme = EVENT_THEMES[evt.type] || EVENT_THEMES.bolide;
    const isSelected = state.selectedEventId === evt.id;
    const card = document.createElement('div');
    card.className = `event-card ${isSelected ? 'selected' : ''}`;
    card.setAttribute('data-type', evt.type);
    card.setAttribute('data-event-id', evt.id);

    const timeStr = evt.timestamp.substring(11, 16) + ' UTC';

    card.innerHTML = `
      <div class="event-header">
        <span class="event-type-badge">${theme.iconSvg}${theme.label}</span>
        <span class="event-time">${timeStr}</span>
      </div>
      <div class="event-title">${evt.name}</div>
      <div class="event-desc">${evt.description}</div>
      <div class="event-footer">
        <span class="event-coords">${formatCoord(evt.coordinates[0], true)}, ${formatCoord(evt.coordinates[1], false)}</span>
        <span class="event-intensity-tag intensity-${evt.intensity || 'medium'}">${evt.intensity || 'Active'}</span>
      </div>
    `;

    card.addEventListener('click', () => selectEvent(evt.id, true));
    dom.eventsList.appendChild(card);
  });
}

function selectEvent(eventId, flyToMap = true) {
  state.selectedEventId = eventId;
  
  document.querySelectorAll('.event-card').forEach(el => {
    if (el.getAttribute('data-event-id') === eventId) {
      el.classList.add('selected');
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      el.classList.remove('selected');
    }
  });

  const evt = state.events.find(e => e.id === eventId);
  if (!evt) return;

  if (flyToMap && state.map) {
    state.map.flyTo(evt.coordinates, 6, {
      duration: 1.2,
      easeLinearity: 0.25
    });

    setTimeout(() => {
      if (evt._marker) evt._marker.openPopup();
    }, 400);
  }
}

function updateEventCounts() {
  const total = state.events.length;
  const countVolcano = state.events.filter(e => e.type === 'volcano').length;
  const countRocket = state.events.filter(e => e.type === 'rocket').length;
  const countBolide = state.events.filter(e => e.type === 'bolide').length;

  if (dom.eventTotalCount) dom.eventTotalCount.textContent = `${total} Tracked`;
  if (dom.countAll) dom.countAll.textContent = total;
  if (dom.countVolcano) dom.countVolcano.textContent = countVolcano;
  if (dom.countRocket) dom.countRocket.textContent = countRocket;
  if (dom.countBolide) dom.countBolide.textContent = countBolide;
}

/* ============================================================================
   10. WIND VECTOR OVERLAY & PROBE
   ============================================================================ */

function renderWindVectors() {
  state.windVectorsLayerGroup.clearLayers();
  
  if (!state.showWindVectors || !state.currentWindData) return;

  const vectors = state.currentWindData.vectors || [];

  vectors.forEach(v => {
    const color = getWindColor(v.speed);
    const arrowSize = Math.max(14, Math.min(26, Math.round(14 + (v.speed / 45) * 12)));
    const rotationDeg = (v.direction + 180) % 360;

    const svgIconHtml = `
      <div class="wind-arrow-icon" style="transform: rotate(${rotationDeg}deg); width: ${arrowSize}px; height: ${arrowSize}px;">
        <svg viewBox="0 0 24 24" width="${arrowSize}" height="${arrowSize}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="19" x2="12" y2="5"></line>
          <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
      </div>
    `;

    const icon = L.divIcon({
      className: 'leaflet-wind-vector-icon',
      html: svgIconHtml,
      iconSize: [arrowSize, arrowSize],
      iconAnchor: [arrowSize / 2, arrowSize / 2]
    });

    const marker = L.marker([v.lat, v.lng], {
      icon,
      interactive: true,
      zIndexOffset: 50
    });

    marker.on('mouseover mousemove', () => {
      if (dom.vectorProbeHud) {
        dom.probeCoords.textContent = `${formatCoord(v.lat, true)}, ${formatCoord(v.lng, false)}`;
        dom.probeU.textContent = `${v.u > 0 ? '+' : ''}${v.u.toFixed(1)} m/s (E)`;
        dom.probeV.textContent = `${v.v > 0 ? '+' : ''}${v.v.toFixed(1)} m/s (N)`;
        const knots = (v.speed * 1.94384).toFixed(1);
        dom.probeSpeed.textContent = `${v.speed.toFixed(1)} m/s (${knots} kts)`;
        dom.probeHeading.textContent = `${v.direction}° (${degreesToCompass(v.direction)})`;
        dom.vectorProbeHud.style.display = 'block';
      }
    });

    marker.addTo(state.windVectorsLayerGroup);
  });
}

/* ============================================================================
   11. STREAMLINE CANVAS OVERLAY (TRANSPARENT)
   ============================================================================ */

function setupStreamlineCanvas() {
  state.streamlineCanvas = dom.streamlineCanvas;
  if (!state.streamlineCanvas) return;
  state.streamlineCtx = state.streamlineCanvas.getContext('2d');
  resizeStreamlineCanvas();
}

function resizeStreamlineCanvas() {
  if (!state.streamlineCanvas || !dom.mapContainer) return;
  const rect = dom.mapContainer.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  state.streamlineCanvas.width = rect.width * dpr;
  state.streamlineCanvas.height = rect.height * dpr;
  state.streamlineCanvas.style.width = `${rect.width}px`;
  state.streamlineCanvas.style.height = `${rect.height}px`;
  
  if (state.streamlineCtx) {
    state.streamlineCtx.setTransform(1, 0, 0, 1, 0, 0);
    state.streamlineCtx.scale(dpr, dpr);
  }
}

function initStreamlineParticles() {
  if (!state.streamlineCanvas) return;

  const count = 300;
  state.particles = [];

  for (let i = 0; i < count; i++) {
    state.particles.push(createRandomParticle());
  }

  if (!state.animationFrameId) {
    startStreamlineAnimation();
  }
}

function createRandomParticle() {
  return {
    lat: -65 + Math.random() * 135,
    lng: -180 + Math.random() * 360,
    prevLat: null,
    prevLng: null,
    age: Math.floor(Math.random() * 60),
    maxAge: 60 + Math.floor(Math.random() * 50),
    speed: 0
  };
}

function sampleWindAt(lat, lng) {
  if (!state.currentWindData || !state.currentWindData.vectors) {
    return { u: 0, v: 0, speed: 0 };
  }
  
  let nLng = lng;
  while (nLng > 180) nLng -= 360;
  while (nLng < -180) nLng += 360;

  const vectors = state.currentWindData.vectors;
  let closest = null;
  let minDist = Infinity;
  for (let i = 0; i < vectors.length; i++) {
    const v = vectors[i];
    const dLat = v.lat - lat;
    const dLng = v.lng - nLng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDist) {
      minDist = distSq;
      closest = v;
      if (distSq < 15) break;
    }
  }

  return closest || { u: 0, v: 0, speed: 0 };
}

function startStreamlineAnimation() {
  function animate() {
    if (!state.map || !state.streamlineCtx) {
      state.animationFrameId = requestAnimationFrame(animate);
      return;
    }

    const ctx = state.streamlineCtx;
    const rect = dom.mapContainer.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Clear canvas completely so map tiles remain visible
    ctx.clearRect(0, 0, width, height);

    if (!state.showStreamlines) {
      state.animationFrameId = requestAnimationFrame(animate);
      return;
    }

    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';

    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      p.age++;

      if (p.age >= p.maxAge) {
        state.particles[i] = createRandomParticle();
        continue;
      }

      const sample = sampleWindAt(p.lat, p.lng);
      p.speed = sample.speed;

      p.prevLat = p.lat;
      p.prevLng = p.lng;

      const dt = 0.045;
      p.lng += sample.u * dt;
      p.lat += sample.v * dt;

      if (p.lng > 180) p.lng -= 360;
      if (p.lng < -180) p.lng += 360;

      if (p.lat > 80 || p.lat < -80) {
        state.particles[i] = createRandomParticle();
        continue;
      }

      const pt1 = state.map.latLngToContainerPoint([p.prevLat, p.prevLng]);
      const pt2 = state.map.latLngToContainerPoint([p.lat, p.lng]);

      const dx = Math.abs(pt2.x - pt1.x);
      if (dx < 100 &&
          pt2.x >= -10 && pt2.x <= width + 10 &&
          pt2.y >= -10 && pt2.y <= height + 10) {
        const color = getWindColor(p.speed);
        const alpha = Math.sin((p.age / p.maxAge) * Math.PI) * 0.85;
        
        ctx.strokeStyle = color;
        ctx.globalAlpha = Math.max(0.15, alpha);
        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1.0;
    state.animationFrameId = requestAnimationFrame(animate);
  }

  state.animationFrameId = requestAnimationFrame(animate);
}

/* ============================================================================
   12. TIME SCRUBBER & TRANSPORT (00h - 23h)
   ============================================================================ */

function setHour(hourIndex, updateSlider = true) {
  hourIndex = Math.max(0, Math.min(23, hourIndex));
  state.currentHour = hourIndex;

  if (updateSlider && dom.timeSlider) {
    dom.timeSlider.value = hourIndex;
  }

  const padHour = pad2(hourIndex);
  if (dom.scrubberTimeText) {
    dom.scrubberTimeText.textContent = `2026-10-05 ${padHour}:00 UTC`;
  }
  if (dom.scrubberRelativeText) {
    const diff = hourIndex - 23;
    const relStr = diff === 0 ? 'Current Frame (Latest)' : `${diff}h from Present`;
    dom.scrubberRelativeText.textContent = `Hour ${padHour} of 23 · ${relStr}`;
  }

  document.querySelectorAll('.tick-mark').forEach(el => {
    const h = parseInt(el.getAttribute('data-hour'), 10);
    el.classList.toggle('active', h === hourIndex);
  });

  loadWindDataForHour(hourIndex);
}

function buildTimelineTicks() {
  if (!dom.timelineTicksContainer) return;
  dom.timelineTicksContainer.innerHTML = '';

  for (let h = 0; h < 24; h++) {
    const pad = pad2(h);
    const tick = document.createElement('div');
    tick.className = `tick-mark ${h % 3 === 0 ? 'major' : ''} ${h === state.currentHour ? 'active' : ''}`;
    tick.setAttribute('data-hour', h);
    tick.title = `Jump to ${pad}:00 UTC`;

    const matchingEvent = state.events.find(e => {
      const evtHour = parseInt(e.timestamp.substring(11, 13), 10);
      return evtHour === h;
    });

    let indicatorHtml = '';
    if (matchingEvent) {
      indicatorHtml = `<div class="tick-event-indicator ${matchingEvent.type}" title="${matchingEvent.name} (${matchingEvent.type})"></div>`;
    }

    tick.innerHTML = `
      ${indicatorHtml}
      <div class="tick-line"></div>
      <span class="tick-label">${h % 3 === 0 ? pad + 'h' : ''}</span>
    `;

    tick.addEventListener('click', () => setHour(h, true));
    dom.timelineTicksContainer.appendChild(tick);
  }
}

function togglePlayback() {
  if (state.isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  state.isPlaying = true;
  if (dom.iconPlay) dom.iconPlay.style.display = 'none';
  if (dom.iconPause) dom.iconPause.style.display = 'block';

  state.playbackInterval = setInterval(() => {
    const nextHour = (state.currentHour + 1) % 24;
    setHour(nextHour, true);
  }, state.playbackSpeedMs);
}

function pausePlayback() {
  state.isPlaying = false;
  if (dom.iconPlay) dom.iconPlay.style.display = 'block';
  if (dom.iconPause) dom.iconPause.style.display = 'none';

  if (state.playbackInterval) {
    clearInterval(state.playbackInterval);
    state.playbackInterval = null;
  }
}

/* ============================================================================
   13. FILE IMPORT & MODAL EVENT HANDLERS
   ============================================================================ */

function setupModalAndUploadListeners() {
  // 1. NetCDF Pipeline Modal
  if (dom.btnOpenNetcdfModal) {
    dom.btnOpenNetcdfModal.addEventListener('click', () => {
      if (dom.modalNetcdf) dom.modalNetcdf.classList.add('open');
    });
  }
  if (dom.btnCloseNetcdfModal) {
    dom.btnCloseNetcdfModal.addEventListener('click', () => {
      if (dom.modalNetcdf) dom.modalNetcdf.classList.remove('open');
    });
  }

  // Close modals on backdrop click
  window.addEventListener('click', (e) => {
    if (e.target === dom.modalNetcdf) dom.modalNetcdf.classList.remove('open');
  });

  // Modal Tabs
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const container = tab.closest('.modal-dialog');
      container.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      const targetContent = container.querySelector(`#${targetId}`);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Copy Python Command Button
  if (dom.btnCopyScript) {
    dom.btnCopyScript.addEventListener('click', () => {
      const command = 'python scripts/convert_netcdf_to_webgis.py --input wind.nc --output public/data/wind/';
      navigator.clipboard.writeText(command).then(() => {
        dom.btnCopyScript.textContent = 'Copied!';
        setTimeout(() => { dom.btnCopyScript.textContent = 'Copy Command'; }, 2000);
      });
    });
  }

  // NetCDF Drag & Drop / File Input
  if (dom.netcdfDropzone && dom.netcdfFileInput) {
    dom.netcdfDropzone.addEventListener('click', () => {
      dom.netcdfFileInput.click();
    });

    dom.netcdfDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dom.netcdfDropzone.classList.add('dragover');
    });

    dom.netcdfDropzone.addEventListener('dragleave', () => {
      dom.netcdfDropzone.classList.remove('dragover');
    });

    dom.netcdfDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dom.netcdfDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleNetcdfFileUpload(e.dataTransfer.files[0]);
      }
    });

    dom.netcdfFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleNetcdfFileUpload(e.target.files[0]);
      }
    });
  }

  // Apply uploaded wind data to map
  if (dom.btnApplyUploadedWind) {
    dom.btnApplyUploadedWind.addEventListener('click', () => {
      if (state.pendingUploadedWind) {
        state.currentWindData = state.pendingUploadedWind;
        renderWindVectors();
        initStreamlineParticles();
        
        if (dom.activeFileIndicator) {
          dom.activeFileIndicator.textContent = `[Custom NetCDF Import] (${state.currentWindData.vectors.length} points)`;
        }
        if (dom.scrubberTimeText) {
          dom.scrubberTimeText.textContent = state.currentWindData.timestamp.replace('T', ' ').replace('Z', ' UTC');
        }

        showToast(`Successfully applied ${state.currentWindData.vectors.length} wind vectors to map!`);
        if (dom.modalNetcdf) dom.modalNetcdf.classList.remove('open');
      }
    });
  }
}

/**
 * Handle user uploading a Python-generated NetCDF JSON file
 */
function handleNetcdfFileUpload(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const rawJson = JSON.parse(e.target.result);
      const parsed = parseWindDataset(rawJson);

      state.pendingUploadedWind = parsed;

      // Display inspection panel
      if (dom.uploadInspectPanel) {
        dom.uploadInspectPanel.style.display = 'block';
        dom.inspectTimestamp.textContent = parsed.timestamp;
        dom.inspectVars.textContent = parsed.summary.detectedVars;
        dom.inspectPoints.textContent = `${parsed.summary.totalPoints} vector points`;
        dom.inspectGrid.textContent = parsed.summary.bounds;
        dom.inspectMaxSpeed.textContent = `${parsed.summary.maxSpeed} m/s (${(parsed.summary.maxSpeed * 1.94384).toFixed(1)} kts)`;
      }

      showToast(`NetCDF file parsed: ${parsed.summary.totalPoints} vectors detected!`);
    } catch (err) {
      console.error('Error parsing uploaded NetCDF JSON:', err);
      showToast(`Parse error: ${err.message}`, 4500);
    }
  };
  reader.readAsText(file);
}

/* ============================================================================
   14. EVENT LISTENERS SETUP
   ============================================================================ */

function setupEventListeners() {
  setupModalAndUploadListeners();

  dom.basemapOptions.forEach((button) => {
    button.addEventListener('click', () => selectBasemap(button.dataset.basemap));
  });

  if (dom.landColorInput) {
    dom.landColorInput.value = state.landColor;
    dom.landColorInput.addEventListener('change', () => {
      saveMapColor(dom.landColorInput, 'terra_land_color', 'landColor');
    });
  }

  if (dom.seaColorInput) {
    dom.seaColorInput.value = state.seaColor;
    dom.seaColorInput.addEventListener('change', () => {
      saveMapColor(dom.seaColorInput, 'terra_sea_color', 'seaColor');
    });
  }

  // Time Slider Scrubber
  if (dom.timeSlider) {
    dom.timeSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      setHour(val, false);
    });
  }

  // Transport Buttons
  if (dom.btnPlayPause) dom.btnPlayPause.addEventListener('click', togglePlayback);
  
  if (dom.btnStepPrev) {
    dom.btnStepPrev.addEventListener('click', () => {
      setHour((state.currentHour - 1 + 24) % 24, true);
    });
  }

  if (dom.btnStepNext) {
    dom.btnStepNext.addEventListener('click', () => {
      setHour((state.currentHour + 1) % 24, true);
    });
  }

  if (dom.selectSpeed) {
    dom.selectSpeed.addEventListener('change', (e) => {
      state.playbackSpeedMs = parseInt(e.target.value, 10);
      if (state.isPlaying) {
        pausePlayback();
        startPlayback();
      }
    });
  }

  // Layer Toggles
  if (dom.toggleWindVectors) {
    dom.toggleWindVectors.addEventListener('change', (e) => {
      state.showWindVectors = e.target.checked;
      renderWindVectors();
    });
  }

  if (dom.toggleWindStreamlines) {
    dom.toggleWindStreamlines.addEventListener('change', (e) => {
      state.showStreamlines = e.target.checked;
      if (!state.showStreamlines && state.streamlineCtx) {
        state.streamlineCtx.clearRect(0, 0, state.streamlineCanvas.width, state.streamlineCanvas.height);
      }
    });
  }

  if (dom.toggleEvents) {
    dom.toggleEvents.addEventListener('change', (e) => {
      state.showEvents = e.target.checked;
      renderEventMarkers();
    });
  }

  // Recenter Map
  if (dom.btnRecenter) {
    dom.btnRecenter.addEventListener('click', () => {
      if (state.map) {
        state.map.flyTo([20, 0], 2.5, { duration: 1.0 });
        showToast('View reset to global center');
      }
    });
  }

  const mobileLayout = window.matchMedia('(max-width: 700px)');
  const syncResponsivePanels = (isMobile) => {
    if (dom.sidebar) {
      dom.sidebar.classList.toggle('collapsed', isMobile);
      dom.sidebar.setAttribute('aria-hidden', String(isMobile));
    }
    if (dom.btnToggleSidebar) {
      dom.btnToggleSidebar.setAttribute('aria-expanded', String(!isMobile));
    }
    if (dom.mapControlsHud) {
      dom.mapControlsHud.classList.toggle('collapsed', isMobile);
    }
    if (dom.btnToggleMapControls) {
      dom.btnToggleMapControls.setAttribute('aria-expanded', String(!isMobile));
    }
    if (dom.timeScrubberTray) {
      dom.timeScrubberTray.classList.toggle('collapsed', isMobile);
    }
    if (dom.btnToggleTimeline) {
      dom.btnToggleTimeline.setAttribute('aria-expanded', String(!isMobile));
    }
  };

  syncResponsivePanels(mobileLayout.matches);
  let wasMobileLayout = mobileLayout.matches;

  // Sidebar Toggle
  if (dom.btnToggleSidebar) {
    dom.btnToggleSidebar.addEventListener('click', () => {
      if (dom.sidebar) {
        const isCollapsed = dom.sidebar.classList.toggle('collapsed');
        dom.sidebar.setAttribute('aria-hidden', String(isCollapsed));
        dom.btnToggleSidebar.setAttribute('aria-expanded', String(!isCollapsed));
        setTimeout(() => {
          if (state.map) state.map.invalidateSize();
          resizeStreamlineCanvas();
        }, 250);
      }
    });
  }

  if (dom.btnToggleMapControls && dom.mapControlsHud) {
    dom.btnToggleMapControls.addEventListener('click', () => {
      const isCollapsed = dom.mapControlsHud.classList.toggle('collapsed');
      dom.btnToggleMapControls.setAttribute('aria-expanded', String(!isCollapsed));
    });
  }

  if (dom.btnToggleTimeline && dom.timeScrubberTray) {
    dom.btnToggleTimeline.addEventListener('click', () => {
      const isCollapsed = dom.timeScrubberTray.classList.toggle('collapsed');
      dom.btnToggleTimeline.setAttribute('aria-expanded', String(!isCollapsed));
    });
  }

  // Event Search
  if (dom.eventSearchInput) {
    dom.eventSearchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderEventSidebar();
    });
  }

  // Category Filter Tabs
  dom.filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dom.filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const type = tab.getAttribute('data-type');
      state.activeFilterType = type;
      
      if (dom.sidebarFilterLabel) {
        dom.sidebarFilterLabel.textContent = type === 'all' ? 'Viewing All' : `Filter: ${type.toUpperCase()}`;
      }

      renderEventSidebar();
      renderEventMarkers();
    });
  });

  window.addEventListener('resize', () => {
    const isMobileLayout = mobileLayout.matches;
    if (isMobileLayout !== wasMobileLayout) {
      syncResponsivePanels(isMobileLayout);
      wasMobileLayout = isMobileLayout;
      setTimeout(() => {
        if (state.map) state.map.invalidateSize();
      }, 250);
    }
    resizeStreamlineCanvas();
  });
}

/* ============================================================================
   15. INITIAL BOOTSTRAP
   ============================================================================ */

async function bootstrap() {
  console.log('[BRADEN-GLOBE] Initializing GIS Engine...');
  
  initMap();
  setupStreamlineCanvas();
  setupEventListeners();

  await loadEventsData();
  setHour(state.currentHour, true);

  console.log('[BRADEN-GLOBE] System ready.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
