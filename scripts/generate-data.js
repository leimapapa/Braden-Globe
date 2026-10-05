import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.resolve(__dirname, '../public');
const dataDir = path.join(publicDir, 'data');
const windDir = path.join(dataDir, 'wind');

fs.mkdirSync(windDir, { recursive: true });

// 1. Generate events.json
const events = [
  {
    id: "evt-20261005-001",
    timestamp: "2026-10-05T01:14:22Z",
    hour: 1,
    type: "bolide",
    name: "Bering Sea Superbolide",
    coordinates: [56.92, 172.48],
    description: "Infrasound sensors detected high-altitude explosive airburst with optical flare equivalent to 42 kt TNT equivalent at 25.6 km altitude.",
    intensity: "high",
    magnitude: "42 kt TNT equiv.",
    status: "Terminated / Impact recorded",
    source: "Global Infrasound Array & Optical Transient Sensor"
  },
  {
    id: "evt-20261005-002",
    timestamp: "2026-10-05T03:42:00Z",
    hour: 3,
    type: "volcano",
    name: "Mount Etna Paroxysm",
    coordinates: [37.751, 14.993],
    description: "Violent strombolian transition to sustained lava fountain. Ash column reached 9,500m ASL drifting south-southeast across the Ionian Sea.",
    intensity: "high",
    magnitude: "VEI-3 / Plume 9.5km",
    status: "Ongoing degassing & ash hazard",
    source: "INGV Volcano Observatory Catania"
  },
  {
    id: "evt-20261005-003",
    timestamp: "2026-10-05T05:20:15Z",
    hour: 5,
    type: "rocket",
    name: "Falcon 9 Starlink Group 12-4",
    coordinates: [34.632, -120.611],
    description: "Orbital deployment mission carrying 23 broadband satellites. Stage 1 successful recovery on autonomous spaceport drone ship.",
    intensity: "medium",
    magnitude: "LEO Insertion / 549 km orbit",
    status: "Mission Success",
    source: "Space Launch Delta 30 / USSF Tracking"
  },
  {
    id: "evt-20261005-004",
    timestamp: "2026-10-05T07:11:40Z",
    hour: 7,
    type: "volcano",
    name: "Sundhnúkur Fissure Eruption",
    coordinates: [63.881, -22.392],
    description: "Basaltic fissure opening extended to 2.4 km length. Rapid effusion rate of 140 m³/s feeding lava curtains and north-facing flow front.",
    intensity: "critical",
    magnitude: "Fissure 2.4 km / 140 m³/s",
    status: "High Thermal Output Alert",
    source: "Icelandic Meteorological Office (IMO)"
  },
  {
    id: "evt-20261005-005",
    timestamp: "2026-10-05T09:05:50Z",
    hour: 9,
    type: "bolide",
    name: "Great Basin Fireball Detonation",
    coordinates: [39.512, -115.814],
    description: "Terminal atmospheric fragmentation detected across multiple Doppler radars. Visible streak observed for 6.2 seconds with green chromatic trail.",
    intensity: "medium",
    magnitude: "-14.2 Visual Mag / 0.8 kt",
    status: "Atmospheric Dissipation",
    source: "AMS Fireball Registry #2026-8812"
  },
  {
    id: "evt-20261005-006",
    timestamp: "2026-10-05T10:30:00Z",
    hour: 10,
    type: "rocket",
    name: "Starship Integrated Flight Test",
    coordinates: [25.997, -97.157],
    description: "Full-stack launch from Starbase Pad A. Super Heavy completed boostback burn and tower catch test. Ship re-entry telemetry over Indian Ocean.",
    intensity: "critical",
    magnitude: "Super Heavy + Starship / Suborbital",
    status: "Telemetry Logged",
    source: "FAA Commercial Space Ops / Starbase Control"
  },
  {
    id: "evt-20261005-007",
    timestamp: "2026-10-05T12:45:10Z",
    hour: 12,
    type: "volcano",
    name: "Popocatépetl Explosive Ash Plume",
    coordinates: [19.022, -98.628],
    description: "Moderate explosive sequence with ballistic incandescent fragment projection up to 1.8 km from crater rim. Ash plume drifted west-southwest.",
    intensity: "medium",
    magnitude: "Plume 6.2 km / Yellow Phase 2",
    status: "Volcanic Ash Advisory Active",
    source: "CENAPRED Geophysics Institute"
  },
  {
    id: "evt-20261005-008",
    timestamp: "2026-10-05T14:18:30Z",
    hour: 14,
    type: "bolide",
    name: "Atacama High-Altitude Bolide",
    coordinates: [-23.861, -69.132],
    description: "All-sky meteor patrol cameras captured supersonic fireball traveling at 29.4 km/s. Multiple flash pulses at 41 km and 33 km barometric altitude.",
    intensity: "high",
    magnitude: "-18.5 Peak Mag / 3.4 kt",
    status: "Infrasound Corroborated",
    source: "Southern Sky Transient Monitor Array"
  },
  {
    id: "evt-20261005-009",
    timestamp: "2026-10-05T16:02:00Z",
    hour: 16,
    type: "rocket",
    name: "Electron 'Orbital Horizon'",
    coordinates: [-39.260, 177.865],
    description: "Dedicated orbital launch deploying environmental synthetic aperture radar constellation into 500 km sun-synchronous inclination.",
    intensity: "medium",
    magnitude: "SSO Insertion / Rutherford Engine",
    status: "Orbit Confirmed",
    source: "Mahia Space Complex Control"
  },
  {
    id: "evt-20261005-010",
    timestamp: "2026-10-05T18:22:15Z",
    hour: 18,
    type: "volcano",
    name: "Sakurajima Vulcanian Explosion",
    coordinates: [31.585, 130.657],
    description: "Minamidake crater explosive eruption ejecting volcanic bombs to 1,400m distance. Plume reached 3,200m above crater rim.",
    intensity: "high",
    magnitude: "Crater Overpressure 48 Pa",
    status: "Aviation Alert Orange",
    source: "JMA Kagoshima Volcanological Observatory"
  },
  {
    id: "evt-20261005-011",
    timestamp: "2026-10-05T20:50:00Z",
    hour: 20,
    type: "rocket",
    name: "Ariane 6 Heavy Deployment",
    coordinates: [5.239, -52.768],
    description: "Geostationary transfer orbit injection of meteorological observation payload using Vinci re-ignitable upper stage.",
    intensity: "high",
    magnitude: "GTO Insertion / 10.3 metric tons",
    status: "Stage Separation Nominal",
    source: "ESA Guiana Space Centre ELA-4"
  },
  {
    id: "evt-20261005-012",
    timestamp: "2026-10-05T22:35:10Z",
    hour: 22,
    type: "bolide",
    name: "Western Australia Pilbara Fireball",
    coordinates: [-22.812, 119.231],
    description: "Desert Fireball Network recorded low-angle terminal trajectory with surviving meteorite fall footprint modeled in the Hamersley Range.",
    intensity: "medium",
    magnitude: "Est. Pre-Atmospheric Mass 120 kg",
    status: "Trajectory Triangulated",
    source: "Desert Fireball Network Australia"
  }
];

fs.writeFileSync(path.join(dataDir, 'events.json'), JSON.stringify(events, null, 2));
console.log(`Generated ${events.length} events in events.json`);

// 2. Generate 24 Hourly wind files
// Format:
// wind_20261005_0000.json to wind_20261005_2300.json
// Grid spanning lat: -70 to 70 step 10, lng: -180 to 170 step 15
const lats = [];
for (let lat = -70; lat <= 70; lat += 10) lats.push(lat);
const lngs = [];
for (let lng = -180; lng < 180; lng += 15) lngs.push(lng);

for (let hour = 0; hour < 24; hour++) {
  const padHour = String(hour).padStart(2, '0');
  const filename = `wind_20261005_${padHour}00.json`;
  const timestamp = `2026-10-05T${padHour}:00:00Z`;

  const vectors = [];
  const geojsonFeatures = [];

  // Diurnal and orbital phase shift
  const phase = (hour / 24) * 2 * Math.PI;

  lats.forEach(lat => {
    lngs.forEach(lng => {
      // Global atmospheric model formula:
      // 1. Hadley cell / Trade winds: Lat -30 to 30 blow westward (negative u) with Coriolis effect
      // 2. Ferrel cell / Westerlies: Lat 30 to 60 blow eastward (positive u)
      // 3. Polar easterlies: Lat > 60 and < -60 blow westward
      // 4. Traveling cyclonic low-pressure systems drifting over time
      
      let baseU = 0;
      let baseV = 0;

      const absLat = Math.abs(lat);
      if (absLat < 25) {
        // Trade winds (easterly: negative u)
        baseU = -6.5 * Math.cos((absLat / 25) * (Math.PI / 2));
        baseV = (lat > 0 ? -1.8 : 1.8) * Math.sin((absLat / 25) * Math.PI);
      } else if (absLat >= 25 && absLat <= 55) {
        // Mid-latitude Westerlies (strong easterly flow: positive u)
        const intensity = Math.sin(((absLat - 25) / 30) * Math.PI);
        baseU = 14.0 * intensity + 4.0;
        baseV = (lat > 0 ? 3.0 : -3.0) * Math.sin(phase + (lng * Math.PI / 180));
      } else {
        // Polar cell
        baseU = -5.0 * Math.sin(((absLat - 55) / 25) * Math.PI);
        baseV = (lat > 0 ? -2.0 : 2.0);
      }

      // Add dynamic planetary waves (Rossby waves) evolving across the 24h
      const waveNumber = 4;
      const wavePhase = (lng * Math.PI / 180) * waveNumber + phase;
      const rossbyU = Math.sin(wavePhase) * 4.2;
      const rossbyV = Math.cos(wavePhase) * 5.1;

      // Add a traveling North Atlantic Cyclone
      const storm1Lng = -45 + (hour * 2.5); // drifts eastward
      const storm1Lat = 48 + Math.sin(phase) * 3;
      const dLng1 = lng - storm1Lng;
      const dLat1 = lat - storm1Lat;
      const dist1 = Math.sqrt(dLng1 * dLng1 + dLat1 * dLat1);
      let cyclone1U = 0;
      let cyclone1V = 0;
      if (dist1 < 35 && dist1 > 0.5) {
        const stormVortex = 18.0 * Math.exp(-dist1 / 15);
        // Counter-clockwise in NH
        cyclone1U = (dLat1 / dist1) * stormVortex;
        cyclone1V = (-dLng1 / dist1) * stormVortex;
      }

      // Add a traveling West Pacific Typhoon
      const storm2Lng = 135 - (hour * 1.2); // drifts westward
      const storm2Lat = 22 + (hour * 0.4);
      const dLng2 = lng - storm2Lng;
      const dLat2 = lat - storm2Lat;
      const dist2 = Math.sqrt(dLng2 * dLng2 + dLat2 * dLat2);
      let cyclone2U = 0;
      let cyclone2V = 0;
      if (dist2 < 30 && dist2 > 0.5) {
        const stormVortex2 = 22.0 * Math.exp(-dist2 / 12);
        cyclone2U = (dLat2 / dist2) * stormVortex2;
        cyclone2V = (-dLng2 / dist2) * stormVortex2;
      }

      // Combine components
      let u = baseU + rossbyU + cyclone1U + cyclone2U;
      let v = baseV + rossbyV + cyclone1V + cyclone2V;

      // Round to 2 decimals
      u = Math.round(u * 100) / 100;
      v = Math.round(v * 100) / 100;

      const speed = Math.round(Math.sqrt(u * u + v * v) * 100) / 100;
      // Meteorological wind direction: angle from which wind is coming (0 = North, 90 = East, 180 = South, 270 = West)
      let direction = Math.round((Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360);

      vectors.push({
        lat,
        lng,
        u,
        v,
        speed,
        direction
      });

      // Also construct GeoJSON vector line segment representing the vector
      // Arrow length scaled by speed (degrees in lat/lng)
      const scale = 0.15;
      const targetLng = Math.round((lng + (u * scale)) * 1000) / 1000;
      const targetLat = Math.round((lat + (v * scale)) * 1000) / 1000;

      let category = "light";
      if (speed < 5) category = "calm";
      else if (speed < 12) category = "light";
      else if (speed < 20) category = "moderate";
      else if (speed < 30) category = "fresh";
      else if (speed < 45) category = "strong";
      else category = "gale";

      geojsonFeatures.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [lng, lat],
            [targetLng, targetLat]
          ]
        },
        properties: {
          lat,
          lng,
          u,
          v,
          speed,
          direction,
          category
        }
      });
    });
  });

  const windDataset = {
    timestamp,
    hourIndex: hour,
    referenceDate: "2026-10-05",
    header: {
      nx: lngs.length,
      ny: lats.length,
      lo1: -180,
      la1: -70,
      dx: 15,
      dy: 10,
      parameterCategory: "Wind",
      surfaceLevel: "10m_ASL",
      units: "m/s"
    },
    vectors,
    geojson: {
      type: "FeatureCollection",
      features: geojsonFeatures
    }
  };

  fs.writeFileSync(path.join(windDir, filename), JSON.stringify(windDataset));
}

console.log('Successfully generated 24 hourly wind files in public/data/wind/');
