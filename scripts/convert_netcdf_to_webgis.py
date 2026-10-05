"""
Convert NetCDF Meteorological Wind Data (ERA5 / GFS / HRRR / WRF) to WebGIS JSON
==================================================================================
This script reads any standard NetCDF (.nc / .nc4) meteorological file containing
wind vector components (u10/v10, u/v, or UGRD/VGRD) and outputs hourly JSON
files into the WebGIS `/public/data/wind/` directory. If a vertical coordinate
is present, the converter uses its first level.

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
    u_candidates = ['u', 'UGRD', 'u_wind', 'eastward_wind', 'u_component_of_wind', 'u10', 'U10M', 'var131']
    v_candidates = ['v', 'VGRD', 'v_wind', 'northward_wind', 'v_component_of_wind', 'v10', 'V10M', 'var132']

    variables_by_lower_name = {name.lower(): name for name in ds.variables}
    var_u = next((variables_by_lower_name[name.lower()] for name in u_candidates if name.lower() in variables_by_lower_name), None)
    var_v = next((variables_by_lower_name[name.lower()] for name in v_candidates if name.lower() in variables_by_lower_name), None)

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
    if len(ds[coord_lat].dims) != 1 or len(ds[coord_lon].dims) != 1:
        print("[ERROR] The converter requires one-dimensional latitude and longitude coordinates.")
        sys.exit(1)
    lat_dim = ds[coord_lat].dims[0]
    lon_dim = ds[coord_lon].dims[0]
    time_dim = ds[coord_time].dims[0] if coord_time and ds[coord_time].dims else None

    extra_dims = [dim for dim in ds[var_u].dims if dim not in (lat_dim, lon_dim, time_dim)]
    v_extra_dims = [dim for dim in ds[var_v].dims if dim not in (lat_dim, lon_dim, time_dim)]
    if set(extra_dims) != set(v_extra_dims):
        print(f"[ERROR] U and V variables have different non-horizontal dimensions: {extra_dims} vs {v_extra_dims}")
        sys.exit(1)
    vertical_names = {'level', 'lev', 'lvl', 'pressure', 'pressure_level', 'isobaric', 'isobaricinhpa',
                      'height', 'altitude', 'alt', 'z', 'model_level', 'model_level_number', 'hybrid',
                      'plev', 'sigma', 'bottom_top', 'bottom_top_stag', 'height_above_ground', 'heightaboveground'}
    vertical_candidates = []
    for dim in extra_dims:
        coordinate = ds[dim] if dim in ds.coords else None
        standard_name = (coordinate.attrs.get('standard_name', '') if coordinate is not None else '').lower()
        long_name = (coordinate.attrs.get('long_name', '') if coordinate is not None else '').lower()
        axis = (coordinate.attrs.get('axis', '') if coordinate is not None else '').lower()
        positive = (coordinate.attrs.get('positive', '') if coordinate is not None else '').lower()
        if (dim.lower() in vertical_names or 'pressure' in standard_name or 'pressure' in long_name or
                'height' in standard_name or 'height' in long_name or 'altitude' in standard_name or
                positive in ('up', 'down') or axis == 'z'):
            vertical_candidates.append(dim)
    if len(vertical_candidates) > 1:
        print(f"[ERROR] Expected at most one vertical dimension in '{var_u}', found: {vertical_candidates}")
        sys.exit(1)
    vertical_dim = vertical_candidates[0] if vertical_candidates else None
    unsupported_dims = [dim for dim in extra_dims if dim != vertical_dim and ds.sizes[dim] > 1]
    if unsupported_dims:
        print(f"[ERROR] Unsupported non-vertical dimension(s) in '{var_u}': {unsupported_dims}")
        sys.exit(1)
    if vertical_dim and vertical_dim not in ds[var_v].dims:
        print(f"[ERROR] U and V variables do not share vertical dimension '{vertical_dim}'.")
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

    vertical_level = None
    if vertical_dim:
        level_coord = ds[vertical_dim] if vertical_dim in ds.coords else None
        if level_coord is not None:
            vertical_level = str(level_coord.values[0])
            level_unit = level_coord.attrs.get('units')
            if level_unit:
                vertical_level = f"{vertical_level} {level_unit}"
        else:
            vertical_level = "index 0"
        print(f"[INFO] Using the first vertical level: {vertical_level}")

    # 5. Process each hourly time step
    num_times = sub_ds.sizes[time_dim] if time_dim else 1
    print(f"[INFO] Processing {num_times} time step(s)...")

    for idx in range(num_times):
        frame = sub_ds.isel({time_dim: idx}) if time_dim else sub_ds

        # Retrieve timestamp
        if coord_time and coord_time in frame.coords:
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

        selection = {}
        if time_dim and time_dim in frame[var_u].dims:
            selection[time_dim] = idx
        if vertical_dim:
            selection[vertical_dim] = 0
        selection.update({dim: 0 for dim in extra_dims if dim != vertical_dim})
        u_arr = np.asarray(frame[var_u].isel(selection).transpose(lat_dim, lon_dim).values)
        v_arr = np.asarray(frame[var_v].isel(selection).transpose(lat_dim, lon_dim).values)
        vectors = []
        for i_lat, lat in enumerate(target_lats):
            for i_lon, lon in enumerate(target_lons):
                u_val = float(u_arr[i_lat, i_lon])
                v_val = float(v_arr[i_lat, i_lon])

                if not np.isfinite(u_val) or not np.isfinite(v_val):
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
                "verticalDimension": vertical_dim,
                "verticalLevel": vertical_level,
                "gridStep": f"{step_lat}x{step_lon} deg",
                "pointCount": len(vectors)
            },
            "vectors": vectors
        }

        with open(out_filepath, "w", encoding="utf-8") as f:
            json.dump(output_data, f, separators=(',', ':'))

        print(f"  [OK] Frame {idx+1}/{num_times}: {filename} ({len(vectors)} vectors)")

    ds.close()
    print(f"[SUCCESS] All frames generated in {output_dir}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert NetCDF wind vector files to WebGIS JSON format")
    parser.add_argument("--input", "-i", required=True, help="Input NetCDF file (.nc, .nc4)")
    parser.add_argument("--output", "-o", default="public/data/wind", help="Output directory (default: public/data/wind)")
    parser.add_argument("--step-lat", type=float, default=5.0, help="Latitude sampling step in degrees (default: 5.0)")
    parser.add_argument("--step-lon", type=float, default=5.0, help="Longitude sampling step in degrees (default: 5.0)")
    args = parser.parse_args()

    convert_netcdf(args.input, args.output, args.step_lat, args.step_lon)
