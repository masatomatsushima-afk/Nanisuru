import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useUserLocation } from '@/contexts/user-location-context';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type CurrentLocationButtonProps = {
  compact?: boolean;
};

export function CurrentLocationButton({ compact = false }: CurrentLocationButtonProps) {
  const { location, isLoading, errorMessage, fetchLocation } = useUserLocation();

  const label = isLoading
    ? '現在地を取得中...'
    : location
      ? `📍 現在地: ${location.city}`
      : '📍 現在地を取得';

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          compact && styles.buttonCompact,
          location && styles.buttonActive,
          pressed && styles.buttonPressed,
          isLoading && styles.buttonDisabled,
        ]}
        onPress={fetchLocation}
        disabled={isLoading}>
        <Text style={[styles.label, location && styles.labelActive]}>{label}</Text>
        {location ? (
          <Text style={styles.coords}>
            {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
          </Text>
        ) : null}
      </Pressable>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.three,
  },
  wrapCompact: {
    marginBottom: Spacing.two,
  },
  button: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonCompact: {
    paddingVertical: Spacing.two + 2,
  },
  buttonActive: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  label: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  labelActive: {
    color: NS.colors.accent,
  },
  coords: {
    color: NS.colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  error: {
    color: NS.colors.danger,
    fontSize: 13,
    lineHeight: 20,
    marginTop: Spacing.two,
    textAlign: 'center',
    fontWeight: '600',
  },
});
