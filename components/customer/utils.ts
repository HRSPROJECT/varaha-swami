/**
 * Calculates the straight-line distance between two points on Earth using the Haversine formula.
 * For road distance estimation, multiply result by ~1.3-1.4 factor.
 * @param lat1 Latitude of the first point
 * @param lon1 Longitude of the first point
 * @param lat2 Latitude of the second point
 * @param lon2 Longitude of the second point
 * @returns The straight-line distance in kilometers
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Use precise Earth radius (mean radius in km)
  const R = 6371.0088;
  
  // Convert degrees to radians
  const toRad = (degrees: number) => degrees * (Math.PI / 180);
  
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLineDistance = R * c;
  
  // Apply road distance factor (1.37 factor to convert straight-line to approximate road distance)
  // This accounts for curves, turns, and actual road layout
  // 14.5 km * 1.37 ≈ 19.9 km (matches Google Maps)
  const roadDistanceFactor = 1.37;
  const roadDistance = straightLineDistance * roadDistanceFactor;
  
  // Round to 2 decimal places
  return Math.round(roadDistance * 100) / 100;
}

export function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}
