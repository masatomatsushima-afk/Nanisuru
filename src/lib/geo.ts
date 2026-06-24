const EARTH_RADIUS_METERS = 6_371_000;
const WALKING_SPEED_METERS_PER_MINUTE = 80;

export function haversineDistanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export function formatDistanceLabel(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

export function estimateWalkMinutes(meters: number): number {
  return Math.max(1, Math.ceil(meters / WALKING_SPEED_METERS_PER_MINUTE));
}

export function buildGoogleMapsPlaceUrl(
  latitude: number,
  longitude: number,
  name: string,
): string {
  const query = encodeURIComponent(`${name}@${latitude},${longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function buildGoogleMapsSearchUrl(placeName: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`;
}

export function buildGoogleMapsDirectionsUrl(
  originLatitude: number,
  originLongitude: number,
  destination: string,
): string {
  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${originLatitude},${originLongitude}` +
    `&destination=${encodeURIComponent(destination)}`
  );
}
