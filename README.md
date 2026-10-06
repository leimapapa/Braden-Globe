# Braden Globe

Offline-capable GIS dashboard with three local map layers, configurable map colors, an anomalous-event feed, and a collapsible wind timeline.

## Run Locally

**Prerequisites:** Node.js 26.10.0 (tested; see [.nvmrc](./.nvmrc)). Vite requires Node.js 20.19+ or 22.12+.

### Offline map layers

The selector offers three layers stored locally in `public/tiles/`:

- **Shape Map** — Natural Earth 1:10m land geometry as SVG tiles, with low-detail geometry at zooms 0–2, medium detail at 3–4, and original full detail at zoom 5; land and sea colors are configurable and saved in browser storage.
- **Blue Marble** — NASA global shaded-relief imagery as local JPEG tiles, zoom levels 0–3. NASA requests the acknowledgment “Imagery provided by NASA GIBS / ESDIS.”
- **Countries** — Natural Earth 1:10m country outlines, rendered as locally stored SVG tiles.

Natural Earth data is public domain. The 1,365 tile templates for each SVG layer cover zoom levels 0–5 and reference shared geometry. No basemap or data is fetched from external services at runtime; events, wind frames, and all map tiles load from this app.

Regenerate the SVG layers after obtaining the Natural Earth 1:10m land and admin-0 countries GeoJSON files:

```sh
node scripts/generate-svg-map-tiles.mjs ne_10m_land.geojson public/tiles/basemap ne_10m_admin_0_countries.geojson
node scripts/optimize-svg-map-geometry.mjs public/tiles/basemap
```

The map legend can be minimized, and its preference is saved in browser storage. The map controls and legend can be dragged by their grip handles on desktop or mobile, with separate saved positions for each screen size. SVG tiles update after drag and zoom gestures finish to keep interactions responsive. Wind flow is shown as fine, fading streaks that follow the current wind field; the Overlay Layers menu can switch between white streaks and the wind-speed color palette. The choice is saved in browser storage. Flow uses the regular-grid interpolator when available and the nearest-point sampler for non-grid uploads. These rendering and lookup optimizations are handled natively by the browser, so a WebAssembly dependency is not needed.

The NetCDF pipeline/import dialog is available from the Settings menu. Event-feed cards stay compact with truncated descriptions until selected; the selected card expands to show the full description, coordinates, and intensity while the map zooms to the event and opens its popover. The feed centers its cards vertically when the list fits, and keeps the list scrollable from the top when there are more events than fit.

### Wind visualization

Each wind vector has a tapered, color-matched visual trail behind its arrow. The trail is exaggerated for readability and is drawn from the current vector direction; it does not use prior hourly frames or represent elapsed time. Wind level selection and historical-tail controls are not currently exposed. When a frame contains multiple levels, the app uses its top-level `vectors` array, or the first entry in `levels` if no top-level vectors are present.

The map controls panel scrolls within the available screen height, and its map-layer, shape-color, and overlay sections can be expanded or collapsed independently.

The NetCDF converter uses the first vertical level it finds on the U/V wind variables (or the only field when no vertical coordinate exists):

```json
{
  "timestamp": "2026-10-05T10:00:00Z",
  "sourceMetadata": { "verticalLevel": "850 hPa" },
  "vectors": [{ "lat": 0, "lng": 0, "u": 1.2, "v": -0.4, "speed": 1.26, "direction": 108.4 }]
}
```

Existing multi-level JSON frames remain compatible: the app uses their top-level `vectors` array, or their first level when no top-level vectors are present. Generate one local JSON file per hour; visual trails do not require earlier hourly files.


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## GitHub Pages deployment

The `Deploy to GitHub Pages` workflow builds the site with Bun and deploys it from `main` (or when run manually). Pull requests run the build without publishing. The Vite configuration and local data/tile URLs use the `/Braden-Globe/` Pages base path so local map assets load from the project site.

To enable deployment, ensure GitHub Pages is configured to use **GitHub Actions** as its build and deployment source in the repository’s Pages settings.
