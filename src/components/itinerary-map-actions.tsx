import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useUserLocation } from '@/contexts/user-location-context';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  canOfferDirections,
  getDirectionsUrlFromCurrentLocation,
  getPlaceMapsUrlOrNull,
} from '@/lib/concierge-links';
import type { ItineraryItem } from '@/types/plan';

export const DIRECTIONS_LOCATION_PERMISSION_HINT =
  '位置情報を許可すると現在地から案内できます';

type ItineraryMapActionsProps = {
  item: ItineraryItem;
  /** Trip destination (e.g. "韓国") — ensures map/direction queries stay scoped to it. */
  location?: string;
};

async function openGoogleMapsUrl(url: string): Promise<boolean> {
  if (!url.trim() || /undefined|null|NaN|invalid/i.test(url)) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[maps-link]', {
        invalidExternalLinkBlocked: true,
        externalLinkOpened: false,
      });
    }
    return false;
  }
  try {
    await Linking.openURL(url);
    if (process.env.NODE_ENV !== 'production') {
      console.info('[maps-link]', {
        externalLinkOpened: true,
        mapsLinkType: 'opened',
      });
    }
    return true;
  } catch {
    return false;
  }
}

export function ItineraryMapActions({ item, location }: ItineraryMapActionsProps) {
  const { location: currentLocation, fetchLocation } = useUserLocation();
  const [directionsHint, setDirectionsHint] = useState<string | null>(null);
  const [isDirectionsLoading, setIsDirectionsLoading] = useState(false);
  const directionsInFlight = useRef(false);

  const mapsUrl = getPlaceMapsUrlOrNull(item, location);
  const showDirections = canOfferDirections(item) && Boolean(mapsUrl);

  const handleOpenPlace = () => {
    if (!mapsUrl) return;
    setDirectionsHint(null);
    void openGoogleMapsUrl(mapsUrl);
  };

  const handleDirections = async () => {
    if (directionsInFlight.current || isDirectionsLoading) return;
    directionsInFlight.current = true;
    setDirectionsHint(null);

    try {
      let coords = currentLocation;

      if (!coords) {
        setIsDirectionsLoading(true);
        if (process.env.NODE_ENV !== 'production') {
          console.info('[maps-link]', { locationPermissionState: 'requesting' });
        }
        const outcome = await fetchLocation();
        setIsDirectionsLoading(false);
        coords = outcome.location;

        if (!coords) {
          if (process.env.NODE_ENV !== 'production') {
            console.info('[maps-link]', {
              locationPermissionState: 'denied_or_unavailable',
              directionsAvailable: false,
            });
          }
          setDirectionsHint(DIRECTIONS_LOCATION_PERMISSION_HINT);
          return;
        }

        if (process.env.NODE_ENV !== 'production') {
          console.info('[maps-link]', {
            locationPermissionState: 'granted',
            directionsAvailable: true,
          });
        }
      }

      const url = getDirectionsUrlFromCurrentLocation(
        item,
        coords.latitude,
        coords.longitude,
        location,
      );

      if (!url) {
        if (mapsUrl) {
          await openGoogleMapsUrl(mapsUrl);
        } else {
          setDirectionsHint('この場所は地図情報を確認できませんでした');
        }
        return;
      }

      const opened = await openGoogleMapsUrl(url);
      if (!opened && mapsUrl) {
        await openGoogleMapsUrl(mapsUrl);
      }
    } catch {
      setIsDirectionsLoading(false);
      if (mapsUrl) {
        await openGoogleMapsUrl(mapsUrl);
      } else {
        setDirectionsHint(DIRECTIONS_LOCATION_PERMISSION_HINT);
      }
    } finally {
      setIsDirectionsLoading(false);
      directionsInFlight.current = false;
    }
  };

  if (!mapsUrl && !showDirections) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {mapsUrl ? (
          <Pressable
            style={({ pressed }) => [styles.button, styles.buttonPrimary, pressed && styles.pressed]}
            onPress={handleOpenPlace}
            accessibilityRole="link"
            accessibilityLabel="Google Mapsで開く">
            <Text style={styles.buttonText}>📍 Google Mapsで開く</Text>
          </Pressable>
        ) : null}
        {showDirections ? (
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonSecondary,
              pressed && styles.pressed,
              isDirectionsLoading && styles.buttonDisabled,
            ]}
            onPress={() => void handleDirections()}
            disabled={isDirectionsLoading}
            accessibilityRole="button"
            accessibilityLabel="現在地から道案内">
            <Text style={styles.buttonTextSecondary}>
              {isDirectionsLoading ? '現在地を取得中...' : '📍 現在地から道案内'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {directionsHint ? <Text style={styles.hintText}>{directionsHint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    alignItems: 'center',
  },
  button: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: NS.radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two + 2,
    alignItems: 'center',
    borderWidth: 1,
  },
  buttonPrimary: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  buttonSecondary: {
    backgroundColor: NS.colors.bgInput,
    borderColor: NS.colors.borderStrong,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.88,
  },
  buttonText: {
    color: NS.colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonTextSecondary: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  hintText: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
