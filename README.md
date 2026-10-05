# Braden Globe

Offline-capable GIS dashboard with three local map layers, configurable map colors, an anomalous-event feed, and a collapsible wind timeline.

## Run Locally

**Prerequisites:** Node.js 26.10.0 (tested; see [.nvmrc](./.nvmrc)). Vite requires Node.js 20.19+ or 22.12+.

### Offline map layers

The selector offers three layers stored locally in `public/tiles/`:

- **Shape Map** — high-resolution Natural Earth 1:10m land geometry as SVG tiles; land and sea colors are configurable and saved in browser storage.
- **Blue Marble** — NASA global shaded-relief imagery as local JPEG tiles, zoom levels 0–3. NASA requests the acknowledgment “Imagery provided by NASA GIBS / ESDIS.”
- **Countries** — Natural Earth 1:10m country outlines, rendered as locally stored SVG tiles.

Natural Earth data is public domain. The 1,365 tile templates for each SVG layer cover zoom levels 0–5 and reference shared geometry. No basemap or data is fetched from external services at runtime; events, wind frames, and all map tiles load from this app.

Regenerate the SVG layers after obtaining the Natural Earth 1:10m land and admin-0 countries GeoJSON files:

```sh
node scripts/generate-svg-map-tiles.mjs ne_10m_land.geojson public/tiles/basemap ne_10m_admin_0_countries.geojson
```


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
