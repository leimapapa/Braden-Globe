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

The map legend can be minimized, and its preference is saved in browser storage. SVG tiles update after drag and zoom gestures finish to keep interactions responsive. Streamlines interpolate the regular wind grid directly instead of searching every wind point for each animated particle; non-grid uploads retain the nearest-point sampler. These rendering and lookup optimizations are handled natively by the browser, so a WebAssembly dependency is not needed.


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## GitHub Pages deployment

The `Deploy to GitHub Pages` workflow builds the site with Bun and deploys it from `main` (or when run manually). Pull requests run the build without publishing. The Vite configuration and local data/tile URLs use the `/Braden-Globe/` Pages base path so local map assets load from the project site.

To enable deployment, ensure GitHub Pages is configured to use **GitHub Actions** as its build and deployment source in the repository’s Pages settings.
