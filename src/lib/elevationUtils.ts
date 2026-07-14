import { getElevationTile } from './idb';

/**
 * Decode elevation from Terrarium RGB format
 * Formula: (R * 256 + G + B / 256) - 32768
 * This gives elevation in meters
 */
export function decodeTerrainRGB(r: number, g: number, b: number): number {
  return (r * 256 + g + b / 256) - 32768;
}

/**
 * Get elevation at a specific lat/lng coordinate from cached tiles
 * Returns elevation in meters, or null if tile not found
 */
export async function getElevationAtPoint(
  lat: number,
  lng: number,
  zoom: number = 14
): Promise<number | null> {
  // Convert lat/lng to tile coordinates
  const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  
  // Get the tile from cache
  const tileBlob = await getElevationTile(zoom, x, y);
  if (!tileBlob) {
    return null;
  }
  
  // Create image from blob
  const imageUrl = URL.createObjectURL(tileBlob);
  const img = new Image();
  
  return new Promise((resolve, reject) => {
    img.onload = () => {
      try {
        // Create canvas to read pixel data
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(null);
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        
        // Calculate pixel position within tile
        const tileSize = 256;
        const pixelX = Math.floor(((lng + 180) / 360 * Math.pow(2, zoom) - x) * tileSize);
        const pixelY = Math.floor(((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom) - y) * tileSize);
        
        // Get pixel color
        const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
        const elevation = decodeTerrainRGB(pixel[0], pixel[1], pixel[2]);
        
        URL.revokeObjectURL(imageUrl);
        resolve(elevation);
      } catch (error) {
        console.error('Error decoding elevation:', error);
        URL.revokeObjectURL(imageUrl);
        resolve(null);
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('Failed to load elevation tile image'));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Get elevation profile between two points
 * Returns array of {distance, elevation} points
 */
export async function getElevationProfile(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  samples: number = 50,
  zoom: number = 14
): Promise<Array<{ distance: number; elevation: number; lat: number; lng: number }> | null> {
  const profile: Array<{ distance: number; elevation: number; lat: number; lng: number }> = [];
  
  // Calculate total distance (Haversine formula)
  const R = 6371000; // Earth radius in meters
  const φ1 = startLat * Math.PI / 180;
  const φ2 = endLat * Math.PI / 180;
  const Δφ = (endLat - startLat) * Math.PI / 180;
  const Δλ = (endLng - startLng) * Math.PI / 180;
  
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const totalDistance = R * c;
  
  // Sample points along the line
  for (let i = 0; i <= samples; i++) {
    const fraction = i / samples;
    const lat = startLat + (endLat - startLat) * fraction;
    const lng = startLng + (endLng - startLng) * fraction;
    const distance = totalDistance * fraction;
    
    const elevation = await getElevationAtPoint(lat, lng, zoom);
    
    if (elevation === null) {
      console.warn(`No elevation data for point ${i}/${samples}`);
      // Continue with null elevation rather than failing completely
      profile.push({ distance, elevation: 0, lat, lng });
    } else {
      profile.push({ distance, elevation, lat, lng });
    }
  }
  
  return profile;
}

/**
 * Check if elevation data is available for a specific area
 */
export async function hasElevationDataForArea(
  bounds: { north: number; south: number; east: number; west: number },
  zoom: number = 14
): Promise<boolean> {
  // Check center point
  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLng = (bounds.east + bounds.west) / 2;
  
  const x = Math.floor((centerLng + 180) / 360 * Math.pow(2, zoom));
  const y = Math.floor((1 - Math.log(Math.tan(centerLat * Math.PI / 180) + 1 / Math.cos(centerLat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  
  const tile = await getElevationTile(zoom, x, y);
  return tile !== null;
}
