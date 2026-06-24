import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FadeInView } from '@/components/ui/fade-in-view';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { groupNearbyPlacesByCategory } from '@/lib/nearby-places';
import type { NearbyPlace, NearbyPlacesContext } from '@/types/nearby-places';
import { NEARBY_PLACE_CATEGORIES } from '@/types/nearby-places';

function openPlaceInMaps(place: NearbyPlace) {
  const url =
    place.mapsUrl ??
    `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;

  if (Platform.OS === 'web') {
    Linking.openURL(url);
    return;
  }

  const nativeUrl = Platform.select({
    ios: `maps:0,0?q=${encodeURIComponent(place.name)}@${place.latitude},${place.longitude}`,
    android: `geo:${place.latitude},${place.longitude}?q=${encodeURIComponent(place.name)}`,
    default: url,
  });

  Linking.openURL(nativeUrl ?? url);
}

function NearbyPlaceRow({ place }: { place: NearbyPlace }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.placeRow, pressed && styles.placeRowPressed]}
      onPress={() => openPlaceInMaps(place)}>
      <View style={styles.placeMain}>
        <Text style={styles.placeName} numberOfLines={1}>
          {place.name}
        </Text>
        {place.address ? (
          <Text style={styles.placeAddress} numberOfLines={1}>
            {place.address}
          </Text>
        ) : null}
      </View>
      <View style={styles.placeMeta}>
        <Text style={styles.placeDistance}>{place.distanceLabel}</Text>
        <Text style={styles.placeWalk}>徒歩約{place.walkMinutes}分</Text>
        {place.rating != null ? (
          <Text style={styles.placeRating}>★ {place.rating.toFixed(1)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function NearbyPlacesSection({ context }: { context: NearbyPlacesContext }) {
  const grouped = groupNearbyPlacesByCategory(context.places);

  return (
    <FadeInView>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>現在地周辺</Text>
          <Text style={styles.headerTitle}>{context.locationLabel}</Text>
          <Text style={styles.headerMeta}>
            {context.places.length}件 · Google Places · 半径2km
          </Text>
        </View>

        {NEARBY_PLACE_CATEGORIES.map(({ label }) => {
          const places = grouped[label];
          if (!places || places.length === 0) return null;

          return (
            <View key={label} style={styles.categoryBlock}>
              <Text style={styles.categoryTitle}>{label}</Text>
              {places.map((place) => (
                <NearbyPlaceRow key={place.id} place={place} />
              ))}
            </View>
          );
        })}

        <Text style={styles.footerNote}>タップで Google マップを開きます</Text>
      </View>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.border,
    gap: Spacing.three,
  },
  header: {
    gap: 2,
  },
  headerLabel: {
    color: NS.colors.success,
    fontSize: 11,
    fontWeight: '700',
  },
  headerTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  headerMeta: {
    color: NS.colors.textSecondary,
    fontSize: 12,
  },
  categoryBlock: {
    gap: Spacing.one,
  },
  categoryTitle: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: NS.radius.sm,
    backgroundColor: NS.colors.bgCard,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  placeRowPressed: {
    opacity: 0.85,
    borderColor: NS.colors.accentBorder,
  },
  placeMain: {
    flex: 1,
    minWidth: 0,
  },
  placeName: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  placeAddress: {
    color: NS.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  placeMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  placeDistance: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  placeWalk: {
    color: NS.colors.textSecondary,
    fontSize: 11,
  },
  placeRating: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  footerNote: {
    color: NS.colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
});
