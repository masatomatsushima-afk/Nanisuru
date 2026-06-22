import * as Location from 'expo-location';

export type CurrentLocationResult = {
  city: string;
  label: string;
};

function formatLocationLabel(geocode: Location.LocationGeocodedAddress): string | null {
  const parts = [
    geocode.city,
    geocode.district,
    geocode.subregion,
    geocode.region,
  ].filter(Boolean) as string[];

  const unique = [...new Set(parts)];
  if (unique.length === 0) return null;

  return unique.slice(0, 2).join('・');
}

export async function getCurrentCityLabel(): Promise<CurrentLocationResult | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const results = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });

    const geocode = results[0];
    if (!geocode) return null;

    const label = formatLocationLabel(geocode);
    if (!label) return null;

    const city = geocode.city ?? geocode.subregion ?? geocode.region ?? label;
    return { city, label };
  } catch {
    return null;
  }
}
