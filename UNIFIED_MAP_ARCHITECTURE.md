# 🗺️ Enhetlig Kartarkitektur for Aware

## 🎯 Mål

**Ikke lappeteppe, men enhetlig system hvor:**
1. **Datalag** - én sannhetskilde for høydedata og koordinater
2. **Forretningslogikk** - LOS, profiler, avstander - uavhengig av UI
3. **Presentasjonslag** - Leaflet nå, MapLibre senere - bytbart
4. **Lagring** - konsistent koordinatformat og metadata

---

## 📐 Arkitektur-lag

```
┌─────────────────────────────────────────────────────────┐
│  PRESENTASJON (UI) - Bytbart                            │
│  - LeafletMap (nå)                                      │
│  - MapLibreMap (senere)                                 │
│  - Rendering, zoom, pan, overlays                       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  MAP SERVICE (Abstraksjon) - Stabil API                 │
│  - getElevation(lat, lng): Promise<number>              │
│  - getElevationProfile(path): Promise<Profile>          │
│  - calculateLOS(origin, params): Promise<Viewshed>      │
│  - calculateDistance(a, b): number                      │
│  - Coordinate system: WGS84 (lat, lng)                  │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌──────────────────┐      ┌──────────────────┐
│  TERRAIN ENGINE  │      │  TILE PROVIDER   │
│  - DEM decoding  │      │  - Tile loading  │
│  - Interpolation │      │  - Caching       │
│  - Gradients     │      │  - Offline       │
└──────────────────┘      └──────────────────┘
        │                         │
        └────────────┬────────────┘
                     ▼
        ┌────────────────────────┐
        │  DATA STORAGE          │
        │  - Terrarium DEM tiles │
        │  - Tile cache (IDB)    │
        │  - PMTiles (future)    │
        └────────────────────────┘
```

---

## 🔧 Kjernekomponenter

### 1. Coordinate System (foundation)

**Fil:** `src/lib/geo/coordinates.ts`

```typescript
/**
 * Standard coordinate representation across entire app
 * Always use WGS84 (lat, lng) in degrees
 */
export interface Coordinate {
  lat: number;
  lng: number;
}

/**
 * Point with elevation
 */
export interface ElevatedCoordinate extends Coordinate {
  elevation: number;
}

/**
 * Tile coordinate in any projection
 */
export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

/**
 * Convert lat/lng to tile coordinates at zoom level
 */
export function coordToTile(coord: Coordinate, zoom: number): TileCoordinate {
  const x = Math.floor((coord.lng + 180) / 360 * Math.pow(2, zoom));
  const y = Math.floor(
    (1 - Math.log(Math.tan(coord.lat * Math.PI / 180) + 1 / Math.cos(coord.lat * Math.PI / 180)) / Math.PI) / 2 
    * Math.pow(2, zoom)
  );
  return { z: zoom, x, y };
}

/**
 * Convert tile coordinates to lat/lng (NW corner)
 */
export function tileToCoord(tile: TileCoordinate): Coordinate {
  const n = Math.pow(2, tile.z);
  const lng = tile.x / n * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * tile.y / n))) * 180 / Math.PI;
  return { lat, lng };
}

/**
 * Calculate distance between two points (Haversine)
 */
export function distance(a: Coordinate, b: Coordinate): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  
  const x = Math.sin(dLat / 2) ** 2 + 
            Math.cos(lat1) * Math.cos(lat2) * 
            Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  
  return R * c;
}

/**
 * Calculate bearing from A to B (degrees, 0 = north)
 */
export function bearing(a: Coordinate, b: Coordinate): number {
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - 
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/**
 * Calculate destination point given origin, bearing and distance
 */
export function destination(
  origin: Coordinate, 
  bearingDeg: number, 
  distanceM: number
): Coordinate {
  const R = 6371000;
  const brng = bearingDeg * Math.PI / 180;
  const lat1 = origin.lat * Math.PI / 180;
  const lng1 = origin.lng * Math.PI / 180;
  const d = distanceM / R;
  
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + 
    Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  
  const lng2 = lng1 + Math.atan2(
    Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  );
  
  return {
    lat: lat2 * 180 / Math.PI,
    lng: lng2 * 180 / Math.PI,
  };
}

/**
 * Interpolate points along path
 */
export function interpolatePath(
  start: Coordinate,
  end: Coordinate,
  samples: number
): Coordinate[] {
  const points: Coordinate[] = [];
  
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    // Simple linear interpolation (good enough for short distances)
    points.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
    });
  }
  
  return points;
}
```

---

### 2. Terrain Engine (core business logic)

**Fil:** `src/lib/terrain/TerrainEngine.ts`

```typescript
import { Coordinate, ElevatedCoordinate, TileCoordinate, coordToTile } from '../geo/coordinates';
import { TileProvider } from './TileProvider';

/**
 * Terrain Engine - single source of truth for elevation data
 * Uses Terrarium DEM encoding
 */
export class TerrainEngine {
  private tileProvider: TileProvider;
  private zoom: number = 13; // Default zoom for elevation queries
  
  constructor(tileProvider: TileProvider, zoom: number = 13) {
    this.tileProvider = tileProvider;
    this.zoom = zoom;
  }
  
  /**
   * Get elevation at a single point
   * Returns null if no data available
   */
  async getElevation(coord: Coordinate): Promise<number | null> {
    const tile = coordToTile(coord, this.zoom);
    const tileData = await this.tileProvider.getTile(tile);
    
    if (!tileData) return null;
    
    // Calculate pixel position within tile
    const tileSize = tileData.width;
    const pixelX = this.coordToPixel(coord, tile, tileSize).x;
    const pixelY = this.coordToPixel(coord, tile, tileSize).y;
    
    // Get pixel value and decode
    const rgb = this.getPixelRGB(tileData, pixelX, pixelY);
    return this.decodeTerrainRGB(rgb.r, rgb.g, rgb.b);
  }
  
  /**
   * Get elevation with bilinear interpolation (smoother)
   */
  async getElevationInterpolated(coord: Coordinate): Promise<number | null> {
    const tile = coordToTile(coord, this.zoom);
    const tileData = await this.tileProvider.getTile(tile);
    
    if (!tileData) return null;
    
    const tileSize = tileData.width;
    const pixel = this.coordToPixel(coord, tile, tileSize);
    
    // Get 4 surrounding pixels
    const x0 = Math.floor(pixel.x);
    const y0 = Math.floor(pixel.y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    
    // Fractional parts for interpolation
    const fx = pixel.x - x0;
    const fy = pixel.y - y0;
    
    // Get elevations at 4 corners
    const e00 = this.getElevationAtPixel(tileData, x0, y0);
    const e10 = this.getElevationAtPixel(tileData, x1, y0);
    const e01 = this.getElevationAtPixel(tileData, x0, y1);
    const e11 = this.getElevationAtPixel(tileData, x1, y1);
    
    // Bilinear interpolation
    const e0 = e00 * (1 - fx) + e10 * fx;
    const e1 = e01 * (1 - fx) + e11 * fx;
    return e0 * (1 - fy) + e1 * fy;
  }
  
  /**
   * Get elevation profile along a path
   */
  async getElevationProfile(
    path: Coordinate[],
    samplesPerSegment: number = 64
  ): Promise<ElevatedCoordinate[]> {
    const profile: ElevatedCoordinate[] = [];
    
    // Sample along each segment
    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];
      
      for (let j = 0; j < samplesPerSegment; j++) {
        const t = j / samplesPerSegment;
        const coord: Coordinate = {
          lat: start.lat + (end.lat - start.lat) * t,
          lng: start.lng + (end.lng - start.lng) * t,
        };
        
        const elevation = await this.getElevationInterpolated(coord);
        
        profile.push({
          ...coord,
          elevation: elevation ?? 0,
        });
      }
    }
    
    // Add final point
    const lastCoord = path[path.length - 1];
    const lastElevation = await this.getElevationInterpolated(lastCoord);
    profile.push({
      ...lastCoord,
      elevation: lastElevation ?? 0,
    });
    
    return profile;
  }
  
  /**
   * Get slope at a point (degrees)
   */
  async getSlope(coord: Coordinate): Promise<number | null> {
    const tile = coordToTile(coord, this.zoom);
    const tileData = await this.tileProvider.getTile(tile);
    
    if (!tileData) return null;
    
    const tileSize = tileData.width;
    const pixel = this.coordToPixel(coord, tile, tileSize);
    const x = Math.floor(pixel.x);
    const y = Math.floor(pixel.y);
    
    // Get elevations of surrounding pixels (Sobel operator)
    const e00 = this.getElevationAtPixel(tileData, x - 1, y - 1);
    const e10 = this.getElevationAtPixel(tileData, x, y - 1);
    const e20 = this.getElevationAtPixel(tileData, x + 1, y - 1);
    const e01 = this.getElevationAtPixel(tileData, x - 1, y);
    const e21 = this.getElevationAtPixel(tileData, x + 1, y);
    const e02 = this.getElevationAtPixel(tileData, x - 1, y + 1);
    const e12 = this.getElevationAtPixel(tileData, x, y + 1);
    const e22 = this.getElevationAtPixel(tileData, x + 1, y + 1);
    
    // Sobel gradients
    const dx = ((e20 + 2 * e21 + e22) - (e00 + 2 * e01 + e02)) / 8;
    const dy = ((e02 + 2 * e12 + e22) - (e00 + 2 * e10 + e20)) / 8;
    
    // Pixel resolution in meters (approximate)
    const metersPerPixel = this.getPixelResolution(coord.lat, this.zoom);
    
    // Slope magnitude
    const slope = Math.atan(Math.sqrt(dx * dx + dy * dy) / metersPerPixel);
    return slope * 180 / Math.PI; // Convert to degrees
  }
  
  /**
   * Get aspect at a point (degrees, 0 = north)
   */
  async getAspect(coord: Coordinate): Promise<number | null> {
    const tile = coordToTile(coord, this.zoom);
    const tileData = await this.tileProvider.getTile(tile);
    
    if (!tileData) return null;
    
    const tileSize = tileData.width;
    const pixel = this.coordToPixel(coord, tile, tileSize);
    const x = Math.floor(pixel.x);
    const y = Math.floor(pixel.y);
    
    // Simple gradient
    const e_left = this.getElevationAtPixel(tileData, x - 1, y);
    const e_right = this.getElevationAtPixel(tileData, x + 1, y);
    const e_top = this.getElevationAtPixel(tileData, x, y - 1);
    const e_bottom = this.getElevationAtPixel(tileData, x, y + 1);
    
    const dx = (e_right - e_left) / 2;
    const dy = (e_bottom - e_top) / 2;
    
    // Aspect (note: Y is inverted in image coords)
    let aspect = Math.atan2(dx, -dy) * 180 / Math.PI;
    if (aspect < 0) aspect += 360;
    
    return aspect;
  }
  
  // ---- Private helper methods ----
  
  private decodeTerrainRGB(r: number, g: number, b: number): number {
    return r * 256 + g + b / 256 - 32768;
  }
  
  private coordToPixel(
    coord: Coordinate,
    tile: TileCoordinate,
    tileSize: number
  ): { x: number; y: number } {
    const n = Math.pow(2, tile.z);
    const x = ((coord.lng + 180) / 360 * n - tile.x) * tileSize;
    const y = (
      (1 - Math.log(Math.tan(coord.lat * Math.PI / 180) + 1 / Math.cos(coord.lat * Math.PI / 180)) / Math.PI) / 2 * n 
      - tile.y
    ) * tileSize;
    
    return { x, y };
  }
  
  private getPixelRGB(
    tileData: ImageData,
    x: number,
    y: number
  ): { r: number; g: number; b: number } {
    const xi = Math.floor(Math.max(0, Math.min(tileData.width - 1, x)));
    const yi = Math.floor(Math.max(0, Math.min(tileData.height - 1, y)));
    const index = (yi * tileData.width + xi) * 4;
    
    return {
      r: tileData.data[index],
      g: tileData.data[index + 1],
      b: tileData.data[index + 2],
    };
  }
  
  private getElevationAtPixel(
    tileData: ImageData,
    x: number,
    y: number
  ): number {
    const rgb = this.getPixelRGB(tileData, x, y);
    return this.decodeTerrainRGB(rgb.r, rgb.g, rgb.b);
  }
  
  private getPixelResolution(latDeg: number, zoom: number): number {
    // Meters per pixel at given latitude and zoom
    const lat = latDeg * Math.PI / 180;
    const metersPerDegree = 111320 * Math.cos(lat);
    const degreesPerPixel = 360 / (256 * Math.pow(2, zoom));
    return metersPerDegree * degreesPerPixel;
  }
}
```

---

### 3. Tile Provider (data access)

**Fil:** `src/lib/terrain/TileProvider.ts`

```typescript
import { TileCoordinate } from '../geo/coordinates';
import { getElevationTile } from '../idb';

/**
 * Tile Provider - abstract tile loading from storage
 * Handles caching, fallbacks, and data formats
 */
export class TileProvider {
  private cache: Map<string, ImageData> = new Map();
  private maxCacheSize: number = 50; // ~10MB
  private tileSize: number = 256;
  
  constructor(tileSize: number = 256) {
    this.tileSize = tileSize;
  }
  
  /**
   * Get tile data (ImageData)
   * Returns cached if available, otherwise loads from storage
   */
  async getTile(tile: TileCoordinate): Promise<ImageData | null> {
    const key = `${tile.z}/${tile.x}/${tile.y}`;
    
    // Check cache
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    // Load from storage
    const imageData = await this.loadTileFromStorage(tile);
    
    if (imageData) {
      this.cacheImageData(key, imageData);
    }
    
    return imageData;
  }
  
  /**
   * Preload tiles for a bounding box
   * Useful for LOS calculation to batch load
   */
  async preloadTiles(tiles: TileCoordinate[]): Promise<void> {
    const loads = tiles.map(tile => this.getTile(tile));
    await Promise.all(loads);
  }
  
  /**
   * Clear cache to free memory
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  // ---- Private methods ----
  
  private async loadTileFromStorage(tile: TileCoordinate): Promise<ImageData | null> {
    try {
      // Load from IndexedDB
      const blob = await getElevationTile(tile.z, tile.x, tile.y);
      
      if (!blob) return null;
      
      // Convert blob to ImageData
      return await this.blobToImageData(blob);
    } catch (error) {
      console.error('Failed to load tile:', tile, error);
      return null;
    }
  }
  
  private async blobToImageData(blob: Blob): Promise<ImageData | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, this.tileSize, this.tileSize);
        
        URL.revokeObjectURL(url);
        resolve(imageData);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      
      img.src = url;
    });
  }
  
  private cacheImageData(key: string, imageData: ImageData): void {
    // Evict oldest if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, imageData);
  }
}
```

---

### 4. Map Service (facade)

**Fil:** `src/lib/map/MapService.ts`

```typescript
import { Coordinate, ElevatedCoordinate, distance, bearing, destination, interpolatePath } from '../geo/coordinates';
import { TerrainEngine } from '../terrain/TerrainEngine';
import { TileProvider } from '../terrain/TileProvider';

/**
 * Map Service - single interface for all map operations
 * Abstracts terrain, coordinates, and calculations
 */
export class MapService {
  private terrainEngine: TerrainEngine;
  
  constructor(zoom: number = 13) {
    const tileProvider = new TileProvider(256);
    this.terrainEngine = new TerrainEngine(tileProvider, zoom);
  }
  
  // ---- Elevation queries ----
  
  async getElevation(coord: Coordinate): Promise<number | null> {
    return this.terrainEngine.getElevationInterpolated(coord);
  }
  
  async getElevationProfile(path: Coordinate[], samplesPerSegment: number = 64): Promise<ElevatedCoordinate[]> {
    return this.terrainEngine.getElevationProfile(path, samplesPerSegment);
  }
  
  async getSlope(coord: Coordinate): Promise<number | null> {
    return this.terrainEngine.getSlope(coord);
  }
  
  async getAspect(coord: Coordinate): Promise<number | null> {
    return this.terrainEngine.getAspect(coord);
  }
  
  // ---- Coordinate utilities ----
  
  distance(a: Coordinate, b: Coordinate): number {
    return distance(a, b);
  }
  
  bearing(a: Coordinate, b: Coordinate): number {
    return bearing(a, b);
  }
  
  destination(origin: Coordinate, bearingDeg: number, distanceM: number): Coordinate {
    return destination(origin, bearingDeg, distanceM);
  }
  
  interpolatePath(start: Coordinate, end: Coordinate, samples: number): Coordinate[] {
    return interpolatePath(start, end, samples);
  }
  
  // ---- LOS calculation ----
  
  async calculateLOS(
    origin: Coordinate,
    params: {
      radiusM: number;
      rays: number;
      observerHeightM: number;
      targetHeightM: number;
    }
  ): Promise<LOSResult> {
    const { radiusM, rays, observerHeightM, targetHeightM } = params;
    
    const endpoints: Coordinate[] = [];
    const visibleEndpoints: Coordinate[] = [];
    
    // Calculate rays
    for (let i = 0; i < rays; i++) {
      const bearingDeg = (i * 360) / rays;
      const endpoint = destination(origin, bearingDeg, radiusM);
      endpoints.push(endpoint);
      
      // Get elevation profile along ray
      const path = interpolatePath(origin, endpoint, 64);
      const profile = await this.getElevationProfile(path, 1);
      
      // Find visible endpoint
      const visible = this.findVisibleEndpoint(profile, observerHeightM, targetHeightM);
      visibleEndpoints.push(visible);
    }
    
    return {
      origin,
      endpoints,
      visibleEndpoints,
      radiusM,
    };
  }
  
  private findVisibleEndpoint(
    profile: ElevatedCoordinate[],
    observerHeightM: number,
    targetHeightM: number
  ): Coordinate {
    if (profile.length === 0) return profile[0];
    
    const h0 = profile[0].elevation + observerHeightM;
    let maxSlope = -Infinity;
    let visibleIndex = 0;
    let accumulatedDistance = 0;
    
    for (let i = 1; i < profile.length; i++) {
      const dist = distance(profile[i - 1], profile[i]);
      accumulatedDistance += dist;
      
      const targetElevation = profile[i].elevation + targetHeightM;
      const slope = (targetElevation - h0) / Math.max(accumulatedDistance, 1e-6);
      
      if (slope > maxSlope) {
        maxSlope = slope;
        visibleIndex = i;
      }
    }
    
    return profile[visibleIndex];
  }
}

export interface LOSResult {
  origin: Coordinate;
  endpoints: Coordinate[];
  visibleEndpoints: Coordinate[];
  radiusM: number;
}

// Singleton instance
export const mapService = new MapService();
```

---

## 📊 Brukseksempler

### Høydeprofil:
```typescript
import { mapService } from '@/lib/map/MapService';

const path = [
  { lat: 61.5, lng: 11.5 },
  { lat: 61.6, lng: 11.6 },
];

const profile = await mapService.getElevationProfile(path);
// → [{ lat, lng, elevation }, ...]
```

### LOS-beregning:
```typescript
const los = await mapService.calculateLOS(
  { lat: 61.5, lng: 11.5 },
  { radiusM: 2000, rays: 180, observerHeightM: 5, targetHeightM: 0 }
);
// → { origin, endpoints, visibleEndpoints, radiusM }
```

### Enkelt høydepunkt:
```typescript
const elevation = await mapService.getElevation({ lat: 61.5, lng: 11.5 });
// → 534.2 (meters)
```

---

## 🔄 Migreringsplan

### Fase 1: Foundation (1 uke)
1. ✅ Lag `coordinates.ts` - koordinatsystem
2. ✅ Lag `TileProvider.ts` - tile loading
3. ✅ Lag `TerrainEngine.ts` - DEM logikk
4. ✅ Lag `MapService.ts` - facade
5. ✅ Test enkle queries

### Fase 2: Integration (1 uke)
1. ✅ Erstatt `getElevationAtPoint` med `mapService.getElevation`
2. ✅ Erstatt `useViewshed` med `mapService.calculateLOS`
3. ✅ Oppdater høydeprofil til `mapService.getElevationProfile`
4. ✅ Test og feilsøk

### Fase 3: Cleanup (2-3 dager)
1. ✅ Fjern gamle `elevationUtils.ts` (duplikat kode)
2. ✅ Fjern Google API calls (bruk bare fallback)
3. ✅ Konsolider koordinat-konverteringer
4. ✅ Oppdater dokumentasjon

---

## ✅ Fordeler med denne arkitekturen

1. **Enhetlig API** - èn måte å hente høydedata
2. **Testbart** - business logic skilt fra UI
3. **Bytbart** - kan bytte Leaflet → MapLibre uten å endre logikk
4. **Cacheable** - smart tile caching i `TileProvider`
5. **Type-safe** - TypeScript interfaces overalt
6. **Dokumenterbart** - klar arkitektur

---

## 🎯 Neste steg

**Etter kartunderlag er på plass:**
1. UX-forbedringer (progress, feedback)
2. GPS/kompass integrasjon
3. Database-sync cleanup
4. PMTiles for offline

**Men først:** Solid foundation! 🏗️

---

*Plan opprettet: 5. november 2026*
