import * as Location from 'expo-location';

export const LOCATION_PERMISSION_DENIED_MESSAGE =
  '現在地の取得が許可されていません。設定から位置情報を許可するか、エリアを手入力してください。';

export type CurrentLocationResult = {
  city: string;
  label: string;
};

export type CurrentCoordinatesResult = {
  latitude: number;
  longitude: number;
  label: string;
  city: string;
};

export type LocationFetchResult =
  | { status: 'success'; data: CurrentCoordinatesResult }
  | { status: 'denied' }
  | { status: 'error' };

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

async function reverseGeocodePosition(
  latitude: number,
  longitude: number,
): Promise<Location.LocationGeocodedAddress | null> {
  const results = await Location.reverseGeocodeAsync({ latitude, longitude });
  return results[0] ?? null;
}

function buildCoordinatesResult(
  latitude: number,
  longitude: number,
  geocode: Location.LocationGeocodedAddress | null,
): CurrentCoordinatesResult {
  const label = geocode ? formatLocationLabel(geocode) : null;
  const city = geocode?.city ?? geocode?.subregion ?? geocode?.region ?? label ?? '現在地';

  return {
    latitude,
    longitude,
    label: label ?? city,
    city,
  };
}

export async function fetchCurrentLocation(): Promise<LocationFetchResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { status: 'denied' };
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const geocode = await reverseGeocodePosition(
      position.coords.latitude,
      position.coords.longitude,
    );

    return {
      status: 'success',
      data: buildCoordinatesResult(
        position.coords.latitude,
        position.coords.longitude,
        geocode,
      ),
    };
  } catch {
    return { status: 'error' };
  }
}

export async function getCurrentCoordinates(): Promise<CurrentCoordinatesResult | null> {
  const result = await fetchCurrentLocation();
  if (result.status === 'success') return result.data;
  return null;
}

export async function getCurrentCityLabel(): Promise<CurrentLocationResult | null> {
  const result = await getCurrentCoordinates();
  if (!result) return null;

  return {
    city: result.city,
    label: result.label,
  };
}
