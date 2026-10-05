"""
Convert NetCDF Meteorological Wind Data (ERA5 / GFS / HRRR / WRF) to WebGIS JSON
==================================================================================
This script reads any standard NetCDF (.nc / .nc4) meteorological file containing
wind vector components (u10/v10, u/v, or UGRD/VGRD) and outputs lightweight,
hourly JSON files directly into the WebGIS `/public/data/wind/` directory.

Prerequisites:
    pip install xarray netCDF4 numpy

Usage:
    python scripts/convert_netcdf_to_webgis.py --input path/to/wind.nc --output public/data/wind/
"""

import argparse
import json
import os
import sys

def convert_netcdf(nc_path, output_dir, step_lat=5.0, step_lon=5.0):
    try:
        import xarray as xr
        import numpy as np
    except ImportError:
        print("[ERROR] Required libraries not installed. Please run:")
        print("    pip install xarray netCDF4 numpy")
        sys.exit(1)

    if not os.path.exists(nc_path):
        print(f"[ERROR] Input file does not exist: {nc_path}")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)
    print(f"[INFO] Opening NetCDF dataset: {nc_path}")
    ds = xr.open_dataset(nc_path)

    # 1. Identify U and V variable names (zonal & meridional components)
    u_candidates = ['u10', 'u', 'UGRD', 'u_wind', 'eastward_wind', 'U10M', 'var131']
    v_candidates = ['v10', 'v', 'VGRD', 'v_wind', 'northward_wind', 'V10M', 'var132']

    var_u = next((v for v in u_candidates if v in ds.variables), None)
    var_v = next((v for v in v_candidates if v in ds.variables), None)

    if not var_u or not var_v:
        print(f"[ERROR] Could not auto-detect wind variables. Found variables: {list(ds.variables.keys())}")
        print("Please ensure your NetCDF file contains U and V wind components.")
        sys.exit(1)

    print(f"[INFO] Detected wind variables: U = '{var_u}', V = '{var_v}'")

    # 2. Identify Latitude and Longitude coordinate names
    lat_candidates = ['latitude', 'lat', 'nav_lat', 'y']
    lon_candidates = ['longitude', 'lon', 'nav_lon', 'x']
    time_candidates = ['time', 'valid_time', 'forecast_time', 't']

    coord_lat = next((c for c in lat_candidates if c in ds.coords), None)
    coord_lon = next((c for c in lon_candidates if c in ds.coords), None)
    coord_time = next((t for t in time_candidates if t in ds.coords), None)

    if not coord_lat or not coord_lon:
        print(f"[ERROR] Latitude/Longitude coordinates not found in: {list(ds.coords.keys())}")
        sys.exit(1)

    # 3. Normalize Longitude from [0, 360] to [-180, 180] if necessary
    lons = ds[coord_lon].values
    if np.any(lons > 180):
        print("[INFO] Converting longitude coordinates from [0, 360] to [-180, 180]...")
        ds = ds.assign_coords({coord_lon: (((ds[coord_lon] + 180) % 360) - 180)}).sortby(coord_lon)

    # Ensure latitude is strictly sorted
    if ds[coord_lat].values[0] > ds[coord_lat].values[-1]:
        ds = ds.sortby(coord_lat)

    # 4. Grid Subsampling for smooth web GIS performance
    lats = ds[coord_lat].values
    lons = ds[coord_lon].values
    lat_step_idx = max(1, int(round(step_lat / abs(float(np.diff(lats)[0]))))) if len(lats) > 1 else 1
    lon_step_idx = max(1, int(round(step_lon / abs(float(np.diff(lons)[0]))))) if len(lons) > 1 else 1

    sub_ds = ds.isel({coord_lat: slice(0, None, lat_step_idx), coord_lon: slice(0, None, lon_step_idx)})
    target_lats = sub_ds[coord_lat].values
    target_lons = sub_ds[coord_lon].values

    print(f"[INFO] Subsampled grid: {len(target_lats)} latitudes x {len(target_lons)} longitudes ({len(target_lats)*len(target_lons)} points per frame)")

    # 5. Process each hourly time step
    num_times = len(sub_ds[coord_time]) if coord_time and coord_time in sub_ds else 1
    print(f"[INFO] Processing {num_times} time step(s)...")

    for idx in range(num_times):
        frame = sub_ds.isel({coord_time: idx}) if coord_time and num_times > 1 else sub_ds
        
        # Squeeze down to 2D matrix (lat, lon)
        u_arr = np.squeeze(frame[var_u].values)
        v_arr = np.squeeze(frame[var_v].values)

        # Retrieve timestamp
        if coord_time and coord_time in frame:
            raw_time = str(frame[coord_time].values)
            # Format to ISO 8601 UTC
            time_iso = raw_time[:19] + "Z"
            # Extract YYYYMMDD and HH
            clean_digits = raw_time.replace("-", "").replace(":", "").replace("T", "").replace(" ", "")
            date_part = clean_digits[:8] if len(clean_digits) >= 8 else "20261005"
            hour_part = clean_digits[8:10] if len(clean_digits) >= 10 else f"{idx:02d}"
        else:
            time_iso = f"2026-10-05T{idx:02d}:00:00Z"
            date_part = "20261005"
            hour_part = f"{idx:02d}"

        hour_idx = int(hour_part) % 24
        filename = f"wind_{date_part}_{hour_part}00.json"
        out_filepath = os.path.join(output_dir, filename)

        vectors = []
        for i_lat, lat in enumerate(target_lats):
            for i_lon, lon in enumerate(target_lons):
                u_val = float(u_arr[i_lat, i_lon])
                v_val = float(v_arr[i_lat, i_lon])

                if np.isnan(u_val) or np.isnan(v_val):
                    continue

                speed = float(np.sqrt(u_val**2 + v_val**2))
                direction = float((np.arctan2(-u_val, -v_val) * 180 / np.pi + 360) % 360)

                vectors.append({
                    "lat": round(float(lat), 3),
                    "lng": round(float(lon), 3),
                    "u": round(u_val, 2),
                    "v": round(v_val, 2),
                    "speed": round(speed, 2),
                    "direction": round(direction, 1)
                })

        output_data = {
            "timestamp": time_iso,
            "hourIndex": hour_idx,
            "referenceDate": f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:8]}",
            "format": "netcdf_webgis_vector",
            "sourceMetadata": {
                "uVariable": var_u,
                "vVariable": var_v,
                "gridStep": f"{step_lat}x{step_lon} deg",
                "pointCount": len(vectors)
            },
            "vectors": vectors
        }

        with open(out_filepath, "w", encoding="utf-8") as f:
            json.dump(output_data, f, separators=(',', ':'))

        print(f"  [✓] Frame {idx+1}/{num_times}: {filename} ({len(vectors)} points)")

    print(f"[SUCCESS] All frames generated in {output_dir}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert NetCDF wind vector files to WebGIS JSON format")
    parser.add_argument("--input", "-i", required=True, help="Input NetCDF file (.nc, .nc4)")
    parser.add_argument("--output", "-o", default="public/data/wind", help="Output directory (default: public/data/wind)")
    parser.add_argument("--step-lat", type=float, default=5.0, help="Latitude sampling step in degrees (default: 5.0)")
    parser.add_argument("--step-lon", type=float, default=5.0, help="Longitude sampling step in degrees (default: 5.0)")
    args = parser.parse_args()

    convert_netcdf(args.input, args.output, args.step_lat, args.step_lon)
