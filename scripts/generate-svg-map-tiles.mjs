import fs from 'node:fs';
import path from 'node:path';

const [sourceFile, outputDirectory, countriesFile] = process.argv.slice(2);
const maxZoom = 5;
const tileSize = 256;

if (!sourceFile || !outputDirectory) {
  console.error('Usage: node scripts/generate-svg-map-tiles.mjs <ne_10m_land.geojson> <output-directory>');
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
const countries = countriesFile ? JSON.parse(fs.readFileSync(countriesFile, 'utf8')) : null;
const project = ([longitude, latitude]) => {
  const clampedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = clampedLatitude * Math.PI / 180;
  const x = (longitude + 180) / 360 * tileSize;
  const y = (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * tileSize;
  return [Number(x.toFixed(3)), Number(y.toFixed(3))];
};

function featurePaths(features) {
  const paths = [];
  for (const feature of features) {
    const polygons = feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;

    for (const polygon of polygons) {
      for (const ring of polygon) {
        if (ring.length < 4) continue;

        const projected = ring.map(project);
        paths.push(`M${projected.map(([x, y]) => `${x} ${y}`).join('L')}Z`);
      }
    }
  }
  return paths;
}

const pathParts = featurePaths(source.features);
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(
  path.join(outputDirectory, 'world.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tileSize} ${tileSize}"><title>Natural Earth 1:10m land geometry, public domain</title><path id="land" fill-rule="evenodd" d="${pathParts.join('')}"/></svg>`
);

if (countries) {
  const countryPaths = countries.features.map((feature) => {
    const pathData = featurePaths([feature]).join('');
    return `<path fill-rule="evenodd" d="${pathData}"/>`;
  }).join('');
  fs.writeFileSync(
    path.join(outputDirectory, 'world-countries.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tileSize} ${tileSize}"><title>Natural Earth 1:10m country boundaries, public domain</title><g id="countries">${countryPaths}</g></svg>`
  );
}

for (let zoom = 0; zoom <= maxZoom; zoom += 1) {
  const tilesPerAxis = 2 ** zoom;
  const scale = tilesPerAxis;

  for (let x = 0; x < tilesPerAxis; x += 1) {
    for (let y = 0; y < tilesPerAxis; y += 1) {
      const tileDirectory = path.join(outputDirectory, String(zoom), String(x));
      fs.mkdirSync(tileDirectory, { recursive: true });

      const transform = `translate(${-x * tileSize} ${-y * tileSize}) scale(${scale})`;
      const tile = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}">`,
        `<use href="/tiles/basemap/world.svg#land" transform="${transform}" fill="__LAND_COLOR__"/>`,
        '</svg>'
      ].join('');

      fs.writeFileSync(path.join(tileDirectory, `${y}.svg`), tile);

      if (countries) {
        const countriesDirectory = path.join(outputDirectory, 'political', String(zoom), String(x));
        fs.mkdirSync(countriesDirectory, { recursive: true });
        const politicalTile = [
          `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}">`,
          `<use href="/tiles/basemap/world-countries.svg#countries" transform="${transform}" fill="#244c52" stroke="#9cc7b7" stroke-width="${0.4 / scale}" stroke-linejoin="round"/>`,
          '</svg>'
        ].join('');
        fs.writeFileSync(path.join(countriesDirectory, `${y}.svg`), politicalTile);
      }
    }
  }
}

const tileCount = ((4 ** (maxZoom + 1) - 1) / 3).toLocaleString();
console.log(`Generated ${tileCount} local SVG tile templates at zoom levels 0-${maxZoom}${countries ? ' for shape and country maps' : ''}.`);
