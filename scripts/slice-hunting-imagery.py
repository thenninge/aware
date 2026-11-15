#!/usr/bin/env python3
"""Skjær georeferert flyfoto til XYZ-fliser (Web Mercator), matching Leaflet ImageOverlay."""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "imagery" / "kongshov.jpg"
OUT = ROOT / "public" / "imagery" / "kongshov"
SOUTH, WEST, NORTH, EAST = 60.414954, 12.383394, 60.458911, 12.469397
ZOOMS = range(11, 16)
TILE = 256


def mercator_x(lng: float) -> float:
    return (lng + 180.0) / 360.0


def mercator_y(lat: float) -> float:
    lat_rad = math.radians(lat)
    return (1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Mangler kilderaster: {SRC}")

    img = np.asarray(Image.open(SRC).convert("RGB"), dtype=np.float32)
    h, w, _ = img.shape
    mx0, mx1 = mercator_x(WEST), mercator_x(EAST)
    my0, my1 = mercator_y(NORTH), mercator_y(SOUTH)

    if OUT.exists():
        for old in OUT.glob("*/*/*.png"):
            old.unlink()

    index: dict[str, list[list[int]]] = {}
    written = 0
    skipped = 0

    for z in ZOOMS:
        n = 2**z
        x0 = math.floor(mx0 * n)
        x1 = math.floor(mx1 * n)
        y0 = math.floor(my0 * n)
        y1 = math.floor(my1 * n)
        tiles: list[list[int]] = []
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                px = (np.arange(TILE, dtype=np.float64) + 0.5) / TILE
                world_x = (x + px) / n
                world_y = (y + px) / n
                xx, yy = np.meshgrid(world_x, world_y)
                u = (xx - mx0) / (mx1 - mx0)
                v = (yy - my0) / (my1 - my0)
                inside = (u >= 0) & (u <= 1) & (v >= 0) & (v <= 1)
                if not inside.any():
                    skipped += 1
                    continue

                src_x = np.clip(u * (w - 1), 0, w - 1)
                src_y = np.clip(v * (h - 1), 0, h - 1)
                x0i = np.floor(src_x).astype(np.int32)
                y0i = np.floor(src_y).astype(np.int32)
                x1i = np.clip(x0i + 1, 0, w - 1)
                y1i = np.clip(y0i + 1, 0, h - 1)
                fx = src_x - x0i
                fy = src_y - y0i

                def sample(channel: int) -> np.ndarray:
                    c00 = img[y0i, x0i, channel]
                    c10 = img[y0i, x1i, channel]
                    c01 = img[y1i, x0i, channel]
                    c11 = img[y1i, x1i, channel]
                    return (
                        c00 * (1 - fx) * (1 - fy)
                        + c10 * fx * (1 - fy)
                        + c01 * (1 - fx) * fy
                        + c11 * fx * fy
                    )

                rgba = np.zeros((TILE, TILE, 4), dtype=np.uint8)
                for c in range(3):
                    rgba[:, :, c] = np.clip(sample(c), 0, 255).astype(np.uint8)
                rgba[:, :, 3] = np.where(inside, 255, 0).astype(np.uint8)

                dest = OUT / str(z) / str(x) / f"{y}.png"
                dest.parent.mkdir(parents=True, exist_ok=True)
                Image.fromarray(rgba, "RGBA").save(dest, optimize=True, compress_level=9)
                tiles.append([x, y])
                written += 1
        index[str(z)] = tiles

    (OUT / "tiles.json").write_text(
        json.dumps(
            {
                "id": "kongshov",
                "bounds": {"south": SOUTH, "west": WEST, "north": NORTH, "east": EAST},
                "minZoom": min(ZOOMS),
                "maxZoom": max(ZOOMS),
                "tiles": index,
            },
            indent=2,
        )
        + "\n"
    )
    size = sum(p.stat().st_size for p in OUT.rglob("*.png"))
    print(f"wrote {written} tiles, skipped empty {skipped}, {size / 1024:.0f} KB -> {OUT}")


if __name__ == "__main__":
    main()
