/**
 * Calculates the straight-line distance between two points on Earth using the Haversine formula.
 * @param lat1 Latitude of the first point
 * @param lon1 Longitude of the first point
 * @param lat2 Latitude of the second point
 * @param lon2 Longitude of the second point
 * @returns The straight-line distance in kilometers
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0088;
  const toRad = (degrees: number) => degrees * (Math.PI / 180);
  
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 100) / 100;
}

/**
 * Gets highly accurate driving route using OpenRouteService API
 * More accurate than OSRM, especially in India
 * Free tier: 2000 requests/day
 */
export async function getRoute(
  fromLat: number, 
  fromLon: number, 
  toLat: number, 
  toLon: number
): Promise<{
  distance: number; // in kilometers
  duration: number; // in minutes
  geometry: Array<[number, number]>; // route coordinates for map
  success: boolean;
  error?: string;
}> {
  const apiKey = import.meta.env.VITE_OPENROUTE_API_KEY;
  
  // If no API key, fall back to OSRM
  if (!apiKey || apiKey === 'your_api_key_here') {
    console.warn('⚠️ No OpenRouteService API key found, using OSRM fallback');
    return getRouteOSRM(fromLat, fromLon, toLat, toLon);
  }

  try {
    // OpenRouteService API - highly accurate, especially for India
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?start=${fromLon},${fromLat}&end=${toLon},${toLat}`;
    
    console.log('🗺️ Fetching route from OpenRouteService...');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
        'Authorization': apiKey
      },
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Invalid API key. Get free key at openrouteservice.org');
      }
      throw new Error(`OpenRouteService API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const distanceKm = feature.properties.segments[0].distance / 1000;
      const durationMin = feature.properties.segments[0].duration / 60;
      
      // Extract route geometry (array of [lon, lat] coordinates)
      const geometry: Array<[number, number]> = feature.geometry.coordinates.map(
        (coord: number[]) => [coord[1], coord[0]] // Convert [lon, lat] to [lat, lon]
      );
      
      console.log('✅ OpenRouteService route found:');
      console.log(`   Distance: ${distanceKm.toFixed(2)} km`);
      console.log(`   Duration: ${Math.ceil(durationMin)} minutes`);
      console.log(`   Route points: ${geometry.length}`);
      
      return {
        distance: Math.round(distanceKm * 100) / 100,
        duration: Math.ceil(durationMin),
        geometry,
        success: true
      };
    } else {
      throw new Error('No route found');
    }
  } catch (error: any) {
    console.error('❌ OpenRouteService failed:', error.message);
    console.log('🔄 Falling back to OSRM...');
    
    // Fallback to OSRM if OpenRouteService fails
    return getRouteOSRM(fromLat, fromLon, toLat, toLon);
  }
}

/**
 * Fallback routing using OSRM (free, no API key needed)
 */
async function getRouteOSRM(
  fromLat: number, 
  fromLon: number, 
  toLat: number, 
  toLon: number
): Promise<{
  distance: number;
  duration: number;
  geometry: Array<[number, number]>;
  success: boolean;
  error?: string;
}> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
    
    console.log('🗺️ Fetching route from OSRM (fallback)...');
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceKm = route.distance / 1000;
      const durationMin = route.duration / 60;
      
      const geometry: Array<[number, number]> = route.geometry.coordinates.map(
        (coord: number[]) => [coord[1], coord[0]]
      );
      
      console.log('✅ OSRM route found:');
      console.log(`   Distance: ${distanceKm.toFixed(2)} km`);
      console.log(`   Duration: ${Math.ceil(durationMin)} minutes`);
      
      return {
        distance: Math.round(distanceKm * 100) / 100,
        duration: Math.ceil(durationMin),
        geometry,
        success: true
      };
    } else {
      throw new Error('No route found');
    }
  } catch (error: any) {
    console.error('❌ OSRM also failed:', error.message);
    
    // Last resort: straight-line distance
    const straightDist = haversineDistance(fromLat, fromLon, toLat, toLon);
    const estimatedTime = Math.ceil(straightDist * 3);
    
    console.log('⚠️ Using straight-line calculation (last resort)');
    console.log(`   Distance: ${straightDist.toFixed(2)} km`);
    
    return {
      distance: straightDist,
      duration: estimatedTime,
      geometry: [[fromLat, fromLon], [toLat, toLon]],
      success: false,
      error: error.message
    };
  }
}

/**
 * Legacy function - kept for backward compatibility
 */
export async function getRoadDistance(
  fromLat: number, 
  fromLon: number, 
  toLat: number, 
  toLon: number
): Promise<number> {
  const route = await getRoute(fromLat, fromLon, toLat, toLon);
  return route.distance;
}

export function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}
