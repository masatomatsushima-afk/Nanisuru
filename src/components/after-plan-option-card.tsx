import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useUserLocation } from '@/contexts/user-location-context';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { buildGoogleMapsDirectionsUrl } from '@/lib/geo';
import { buildGoogleImagesSearchUrl, buildInstagramSearchUrl, buildTikTokSearchUrl } from '@/lib/place-preview-links';
import type { AfterPlanOption } from '@/types/after-plan';

type AfterPlanOptionCardProps = {
  option: AfterPlanOption;
  location: string;
  selected?: boolean;
  onSelect?: () => void;
};

async function openUrl(url: string): Promise<void> {
  await Linking.openURL(url);
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]} onPress={onPress}>
      <Text style={styles.linkBtnText}>{label}</Text>
    </Pressable>
  );
}

export function AfterPlanOptionCard({
  option,
  location,
  selected = false,
  onSelect,
}: AfterPlanOptionCardProps) {
  const { location: userLocation, fetchLocation } = useUserLocation();
  const previewQuery = [option.placeName, location, option.placeCategory].filter(Boolean).join(' ');

  const handleDirections = async () => {
    let coords = userLocation;
    if (!coords) {
      const outcome = await fetchLocation();
      coords = outcome.location;
    }
    if (!coords) return;

    const destination =
      option.latitude != null && option.longitude != null
        ? `${option.latitude},${option.longitude}`
        : encodeURIComponent(option.placeName);

    const url = buildGoogleMapsDirectionsUrl(coords.latitude, coords.longitude, destination);
    await openUrl(url);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
      onPress={onSelect}>
      <View style={styles.header}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{option.category}</Text>
        </View>
        {option.isNonAlcohol ? (
          <View style={styles.nonAlcoholBadge}>
            <Text style={styles.nonAlcoholText}>ノンアル</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title}>{option.title}</Text>
      <Text style={styles.placeName}>{option.placeName}</Text>

      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>予算目安</Text>
          <Text style={styles.metaValue}>{option.budgetEstimate}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>移動時間</Text>
          <Text style={styles.metaValue}>{option.travelTime}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>終電</Text>
          <Text style={styles.metaValue}>{option.lastTrainOk}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>おすすめ理由</Text>
        <Text style={styles.sectionText}>{option.reason}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>雰囲気</Text>
        <Text style={styles.sectionText}>{option.atmosphere}</Text>
      </View>

      {option.safetyNote ? (
        <View style={styles.safetyBox}>
          <Text style={styles.safetyText}>⚠️ {option.safetyNote}</Text>
        </View>
      ) : null}

      <View style={styles.linksRow}>
        {option.mapsUrl ? (
          <LinkButton label="📍 Mapsで開く" onPress={() => void openUrl(option.mapsUrl!)} />
        ) : null}
        <LinkButton label="🧭 道案内" onPress={() => void handleDirections()} />
      </View>

      <Text style={styles.atmosphereLabel}>雰囲気をチェック</Text>
      <View style={styles.linksRow}>
        <LinkButton
          label="Instagram"
          onPress={() => void openUrl(buildInstagramSearchUrl(previewQuery))}
        />
        <LinkButton label="TikTok" onPress={() => void openUrl(buildTikTokSearchUrl(previewQuery))} />
        <LinkButton
          label="Google画像"
          onPress={() => void openUrl(buildGoogleImagesSearchUrl(previewQuery))}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.four,
    gap: Spacing.two,
    ...NS.shadow.card,
  },
  cardSelected: {
    borderColor: NS.colors.accentBorder,
    backgroundColor: NS.colors.accentSoft,
  },
  cardPressed: {
    opacity: 0.92,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  categoryBadge: {
    backgroundColor: NS.colors.purpleSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
  },
  categoryText: {
    color: NS.colors.purple,
    fontSize: 11,
    fontWeight: '800',
  },
  nonAlcoholBadge: {
    backgroundColor: NS.colors.mintSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  nonAlcoholText: {
    color: NS.colors.mint,
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  placeName: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metaItem: {
    flexBasis: '30%',
    flexGrow: 1,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.sm,
    padding: Spacing.two,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  metaLabel: {
    color: NS.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  metaValue: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    gap: 4,
  },
  sectionLabel: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  safetyBox: {
    backgroundColor: NS.colors.yellowSoft,
    borderRadius: NS.radius.sm,
    padding: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  safetyText: {
    color: '#B45309',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  linkBtn: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.sm,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
  },
  linkBtnPressed: {
    opacity: 0.88,
    backgroundColor: NS.colors.accentSoft,
  },
  linkBtnText: {
    color: NS.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  atmosphereLabel: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
