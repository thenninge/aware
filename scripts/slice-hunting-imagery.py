#!/usr/bin/env python3
"""Skjær georeferert flyfoto til XYZ-fliser (Web Mercator) for Leaflet.

Flyfotoet er eksportert nord-opp i UTM sone 33 (EPSG:25833, samme som
norgeskart.no), ikke i Web Mercator. Derfor er det rotert ca. 2,3° i forhold
til webkartet og kan ikke legges inn med bare sør/vest/nord/øst-grenser.
Hver flispiksel reprojiseres: Web Mercator -> lat/lon -> UTM33 -> bildepiksel.

Georeferansen (UL-hjørne og meter per piksel) er tilpasset mot vann og veier i
Kartverkets topokart. Ved nytt bilde med samme utsnitt: behold verdiene og kjør
skriptet. Ved nytt utsnitt: finn UTM33-koordinaten til øvre venstre hjørne og
pikselstørrelsen (bildebredde i meter / bredde i piksler).

Bruk:  python3 scripts/slice-hunting-imagery.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "imagery" / "kongshov.jpg"
OUT = ROOT / "public" / "imagery" / "kongshov"

# Georeferanse i EPSG:25833 for øvre venstre hjørne av øvre venstre piksel.
UTM_ZONE = 33
UL_EASTING = 356283.9
UL_NORTHING = 6705529.2
# Meter per piksel. Gjelder bildet i full oppløsning (1352 x 1500 px).
# Skaleres automatisk hvis bildet har annen størrelse men samme utsnitt.
REF_SIZE = (1352, 1500)
PIXEL_X = 3.3047
PIXEL_Y = 3.3082

ZOOMS = range(11, 16)
TILE = 256

# --- GRS80 / UTM (Snyder, Map Projections, s. 61) ---
A = 6378137.0
F = 1 / 298.257222101
E2 = F * (2 - F)
EP2 = E2 / (1 - E2)
K0 = 0.9996


def latlon_to_utm(lat: np.ndarray, lon: np.ndarray, zone: int = UTM_ZONE):
    phi = np.radians(lat)
    lam0 = math.radians(zone * 6 - 183)
    n = A / np.sqrt(1 - E2 * np.sin(phi) ** 2)
    t = np.tan(phi) ** 2
    c = EP2 * np.cos(phi) ** 2
    a = np.cos(phi) * (np.radians(lon) - lam0)
    m = A * (
        (1 - E2 / 4 - 3 * E2**2 / 64 - 5 * E2**3 / 256) * phi
        - (3 * E2 / 8 + 3 * E2**2 / 32 + 45 * E2**3 / 1024) * np.sin(2 * phi)
        + (15 * E2**2 / 256 + 45 * E2**3 / 1024) * np.sin(4 * phi)
        - (35 * E2**3 / 3072) * np.sin(6 * phi)
    )
    easting = 500000 + K0 * n * (
        a + (1 - t + c) * a**3 / 6 + (5 - 18 * t + t**2 + 72 * c - 58 * EP2) * a**5 / 120
    )
    northing = K0 * (
        m
        + n
        * np.tan(phi)
        * (
            a**2 / 2
            + (5 - t + 9 * c + 4 * c**2) * a**4 / 24
            + (61 - 58 * t + t**2 + 600 * c - 330 * EP2) * a**6 / 720
        )
    )
    return easting, northing


def utm_to_latlon(easting: float, northing: float, zone: int = UTM_ZONE):
    """Invers via Newton på framoverformelen (holder for bounds-beregning)."""
    lat, lon = 60.0, zone * 6 - 183.0
    for _ in range(20):
        e, n = latlon_to_utm(np.array(lat), np.array(lon), zone)
        d = 1e-6
        e_lat, n_lat = latlon_to_utm(np.array(lat + d), np.array(lon), zone)
        e_lon, n_lon = latlon_to_utm(np.array(lat), np.array(lon + d), zone)
        j = np.array([[(e_lat - e) / d, (e_lon - e) / d], [(n_lat - n) / d, (n_lon - n) / d]])
        step = np.linalg.solve(j, np.array([easting - e, northing - n]))
        lat += float(step[0])
        lon += float(step[1])
    return lat, lon


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Mangler kilderaster: {SRC}")

    img = np.asarray(Image.open(SRC).convert("RGB"), dtype=np.float32)
    h, w, _ = img.shape
    px = PIXEL_X * REF_SIZE[0] / w
    py = PIXEL_Y * REF_SIZE[1] / h

    corners = [
        utm_to_latlon(UL_EASTING + cx * w * px, UL_NORTHING - cy * h * py)
        for cx in (0, 1)
        for cy in (0, 1)
    ]
    south = min(c[0] for c in corners)
    north = max(c[0] for c in corners)
    west = min(c[1] for c in corners)
    east = max(c[1] for c in corners)

    if OUT.exists():
        for old in OUT.glob("*/*/*.png"):
            old.unlink()
        for d in sorted(OUT.glob("*/*"), reverse=True):
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()

    def tile_x(lon: float, n: int) -> int:
        return math.floor((lon + 180.0) / 360.0 * n)

    def tile_y(lat: float, n: int) -> int:
        r = math.radians(lat)
        return math.floor((1.0 - math.log(math.tan(r) + 1.0 / math.cos(r)) / math.pi) / 2.0 * n)

    index: dict[str, list[list[int]]] = {}
    written = 0
    offs = (np.arange(TILE, dtype=np.float64) + 0.5) / TILE

    for z in ZOOMS:
        n = 2**z
        tiles: list[list[int]] = []
        for x in range(tile_x(west, n), tile_x(east, n) + 1):
            for y in range(tile_y(north, n), tile_y(south, n) + 1):
                wx, wy = np.meshgrid((x + offs) / n, (y + offs) / n)
                lon = wx * 360.0 - 180.0
                lat = np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * wy))))
                e, nn = latlon_to_utm(lat, lon)
                src_x = (e - UL_EASTING) / px - 0.5
                src_y = (UL_NORTHING - nn) / py - 0.5
                inside = (src_x >= -0.5) & (src_x <= w - 0.5) & (src_y >= -0.5) & (src_y <= h - 0.5)
                if not inside.any():
                    continue

                src_x = np.clip(src_x, 0, w - 1)
                src_y = np.clip(src_y, 0, h - 1)
                x0i = np.floor(src_x).astype(np.int32)
                y0i = np.floor(src_y).astype(np.int32)
                x1i = np.clip(x0i + 1, 0, w - 1)
                y1i = np.clip(y0i + 1, 0, h - 1)
                fx = (src_x - x0i)[..., None]
                fy = (src_y - y0i)[..., None]
                rgb = (
                    img[y0i, x0i] * (1 - fx) * (1 - fy)
                    + img[y0i, x1i] * fx * (1 - fy)
                    + img[y1i, x0i] * (1 - fx) * fy
                    + img[y1i, x1i] * fx * fy
                )

                rgba = np.zeros((TILE, TILE, 4), dtype=np.uint8)
                rgba[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
                rgba[:, :, 3] = np.where(inside, 255, 0).astype(np.uint8)

                dest = OUT / str(z) / str(x) / f"{y}.png"
                dest.parent.mkdir(parents=True, exist_ok=True)
                Image.fromarray(rgba, "RGBA").save(dest, optimize=True, compress_level=9)
                tiles.append([x, y])
                written += 1
        index[str(z)] = tiles

    bounds = {
        "south": round(south, 6),
        "west": round(west, 6),
        "north": round(north, 6),
        "east": round(east, 6),
    }
    (OUT / "tiles.json").write_text(
        json.dumps(
            {
                "id": "kongshov",
                "crs": f"EPSG:258{UTM_ZONE}",
                "upperLeft": [UL_EASTING, UL_NORTHING],
                "pixelSize": [px, py],
                "bounds": bounds,
                "minZoom": min(ZOOMS),
                "maxZoom": max(ZOOMS),
                "tiles": index,
            },
            indent=2,
        )
        + "\n"
    )
    size = sum(p.stat().st_size for p in OUT.rglob("*.png"))
    print(f"wrote {written} tiles, {size / 1024:.0f} KB -> {OUT}")
    print("bounds for customHuntingImagery.ts:", json.dumps(bounds))


if __name__ == "__main__":
    main()
