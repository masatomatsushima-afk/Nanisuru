import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useUserLocation } from '@/contexts/user-location-context';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { LOCATION_PERMISSION_DENIED_MESSAGE } from '@/lib/current-location';
import { buildGoogleMapsDirectionsUrl } from '@/lib/geo';
import { buildDirectionsDestination, getPlaceMapsUrl } from '@/lib/concierge-links';
import type { ItineraryItem } from '@/types/plan';

type ItineraryMapActionsProps = {
  item: ItineraryItem;
};

async function openGoogleMapsUrl(url: string): Promise<void> {
  await Linking.openURL(url);
}

export function ItineraryMapActions({ item }: ItineraryMapActionsProps) {
  const { location, fetchLocation } = useUserLocation();
  const [directionsError, setDirectionsError] = useState<string | null>(null);
  const [isDirectionsLoading, setIsDirectionsLoading] = useState(false);

  const destination = buildDirectionsDestination(item);

  const handleOpenPlace = () => {
    setDirectionsError(null);
    void openGoogleMapsUrl(getPlaceMapsUrl(item));
  };

  const handleDirections = async () => {
    setDirectionsError(null);

    let coords = location;

    if (!coords) {
      setIsDirectionsLoading(true);
      const outcome = await fetchLocation();
      setIsDirectionsLoading(false);
      coords = outcome.location;

      if (!coords) {
        setDirectionsError(
          outcome.errorMessage ?? LOCATION_PERMISSION_DENIED_MESSAGE,
        );
        return;
      }
    }

    const url = buildGoogleMapsDirectionsUrl(
      coords.latitude,
      coords.longitude,
      destination,
    );

    try {
      await openGoogleMapsUrl(url);
    } catch {
      setDirectionsError('Google Mapsを開けませんでした');
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.button, styles.buttonPrimary, pressed && styles.pressed]}
          onPress={handleOpenPlace}>
          <Text style={styles.buttonText}>📍 Google Mapsで開く</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonSecondary,
            pressed && styles.pressed,
            isDirectionsLoading && styles.buttonDisabled,
          ]}
          onPress={() => void handleDirections()}
          disabled={isDirectionsLoading}>
          <Text style={styles.buttonTextSecondary}>
            {isDirectionsLoading ? '現在地を取得中...' : '🚶 現在地から道案内'}
          </Text>
        </Pressable>
      </View>
      {directionsError ? <Text style={styles.hint}>{directionsError}</Text> : null}
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
  hint: {
    color: NS.colors.danger,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
});
