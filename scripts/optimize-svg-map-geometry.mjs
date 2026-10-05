import fs from 'node:fs';
import path from 'node:path';

const basemapDirectory = process.argv[2];
if (!basemapDirectory) {
  console.error('Usage: node scripts/optimize-svg-map-geometry.mjs <basemap-directory>');
  process.exit(1);
}

const levels = [
  { name: 'low', tolerance: 0.5 },
  { name: 'medium', tolerance: 0.12 }
];
const tokensPattern = /[MLZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[Ee][-+]?\d+)?/g;

function tokenizePath(data) {
  const tokens = data.match(tokensPattern) || [];
  const rings = [];
  let points = null;
  let command = null;

  for (let index = 0; index < tokens.length;) {
    if (/^[MLZ]$/.test(tokens[index])) {
      command = tokens[index++];
      if (command === 'Z') {
        if (points && points.length >= 4) rings.push(points);
        points = null;
        command = null;
        continue;
      }
    }

    if (command !== 'M' && command !== 'L') {
      throw new Error(`Unsupported SVG path command: ${command}`);
    }

    const point = [Number(tokens[index++]), Number(tokens[index++])];
    if (command === 'M') {
      points = [point];
      command = 'L';
    } else if (points) {
      points.push(point);
    } else {
      throw new Error('SVG line segment appeared outside a ring.');
    }
  }

  return rings;
}

function simplifySegment(points, start, end, toleranceSquared) {
  const keep = new Set([start, end]);
  const stack = [[start, end]];

  while (stack.length) {
    const [firstIndex, lastIndex] = stack.pop();
    const [x1, y1] = points[firstIndex];
    const [x2, y2] = points[lastIndex];
    const dx = x2 - x1;
    const dy = y2 - y1;
    let farthestIndex = -1;
    let farthestDistance = toleranceSquared;

    for (let index = firstIndex + 1; index < lastIndex; index += 1) {
      const [x, y] = points[index];
      const segmentLengthSquared = dx * dx + dy * dy;
      const position = segmentLengthSquared
        ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / segmentLengthSquared))
        : 0;
      const differenceX = x - (x1 + position * dx);
      const differenceY = y - (y1 + position * dy);
      const distanceSquared = differenceX * differenceX + differenceY * differenceY;
      if (distanceSquared > farthestDistance) {
        farthestDistance = distanceSquared;
        farthestIndex = index;
      }
    }

    if (farthestIndex !== -1) {
      keep.add(farthestIndex);
      stack.push([firstIndex, farthestIndex], [farthestIndex, lastIndex]);
    }
  }

  return [...keep].sort((a, b) => a - b).map((index) => points[index]);
}

function simplifyRing(ring, tolerance) {
  const points = ring.slice(0, -1);
  if (points.length <= 3) return ring;

  let pivot = 1;
  let farthestDistance = 0;
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index][0] - points[0][0];
    const dy = points[index][1] - points[0][1];
    const distance = dx * dx + dy * dy;
    if (distance > farthestDistance) {
      farthestDistance = distance;
      pivot = index;
    }
  }

  const toleranceSquared = tolerance * tolerance;
  const firstArc = simplifySegment(points, 0, pivot, toleranceSquared);
  const wrappedArc = points.slice(pivot).concat(points.slice(0, 1));
  const secondArc = simplifySegment(wrappedArc, 0, wrappedArc.length - 1, toleranceSquared);
  const simplified = firstArc.concat(secondArc.slice(1, -1), [firstArc[0]]);
  return simplified.length >= 4 ? simplified : ring;
}

function formatNumber(value) {
  return value.toFixed(3).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

function formatRing(ring) {
  return `M${formatNumber(ring[0][0])} ${formatNumber(ring[0][1])}${ring.slice(1).map(([x, y]) => `L${formatNumber(x)} ${formatNumber(y)}`).join('')}Z`;
}

function extractPathAttributes(contents, id) {
  const pattern = new RegExp(`<path\\b[^>]*\\bid="${id}"[^>]*\\bd="([^"]*)"`, 's');
  const match = contents.match(pattern);
  if (!match) throw new Error(`Could not find SVG path "${id}".`);
  return match[1];
}

function createGeometryVariants(filename, id, isCountryMap) {
  const sourcePath = path.join(basemapDirectory, filename);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const countryPaths = isCountryMap
    ? [...source.matchAll(/<path\b[^>]*\bd="([^"]*)"[^>]*\/>/gs)].map((match) => match[1])
    : [extractPathAttributes(source, id)];
  if (!countryPaths.length) throw new Error(`No SVG geometry paths found in ${filename}.`);

  const tokenized = countryPaths.map(tokenizePath);
  const inputPointCount = tokenized.reduce((sum, rings) => sum + rings.reduce((count, ring) => count + ring.length, 0), 0);
  const totalBytes = fs.statSync(sourcePath).size;

  for (const level of levels) {
    let outputPointCount = 0;
    const outputPaths = tokenized.map((rings) => rings.map((ring) => {
      const simplified = simplifyRing(ring, level.tolerance);
      outputPointCount += simplified.length;
      return formatRing(simplified);
    }).join(''));

    const title = `Natural Earth public-domain ${isCountryMap ? 'country boundaries' : 'land geometry'} (${level.name} detail)`;
    const geometry = isCountryMap
      ? `<g id="${id}">${outputPaths.map((data) => `<path fill-rule="evenodd" d="${data}"/>`).join('')}</g>`
      : `<path id="${id}" fill-rule="evenodd" d="${outputPaths[0]}"/>`;
    const output = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><title>${title}</title>${geometry}</svg>`;
    const outputFilename = filename.replace('.svg', `-${level.name}.svg`);
    fs.writeFileSync(path.join(basemapDirectory, outputFilename), output);
    console.log(`${outputFilename}: ${(Buffer.byteLength(output) / 1024).toFixed(1)} KB, ${outputPointCount.toLocaleString()} / ${inputPointCount.toLocaleString()} points, from ${(totalBytes / 1024).toFixed(1)} KB`);
  }
}

createGeometryVariants('world.svg', 'land', false);
createGeometryVariants('world-countries.svg', 'countries', true);
