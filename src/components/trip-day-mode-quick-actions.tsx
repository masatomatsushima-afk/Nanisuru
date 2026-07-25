import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { APP_MESSAGES } from '@/lib/app-errors';
import { getPlaceMapsUrlOrNull, getWebsiteUrl } from '@/lib/concierge-links';
import {
  getPlacePreviewLinks,
} from '@/lib/place-preview-links';
import { openSocialSearchLink } from '@/lib/open-social-search-link';
import type { ItineraryItem } from '@/types/plan';

type TripDayModeQuickActionsProps = {
  item: ItineraryItem | null;
  location: string;
  onEditItem: () => void;
  onDelay: () => void;
  onRainPlan: () => void;
  onOpenAssistant: () => void;
  rainPlanDisabled?: boolean;
  assistantDisabled?: boolean;
};

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
};

async function openUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('リンクを開けませんでした', APP_MESSAGES.mapsOpenFailed);
  }
}

function ActionButton({ label, onPress, variant = 'secondary', disabled }: ActionButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'danger' && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
      disabled={disabled}
      onPress={onPress}>
      <Text
        style={[
          styles.buttonLabel,
          variant === 'primary' && styles.buttonLabelPrimary,
          variant === 'danger' && styles.buttonLabelDanger,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TripDayModeQuickActions({
  item,
  location,
  onEditItem,
  onDelay,
  onRainPlan,
  onOpenAssistant,
  rainPlanDisabled,
  assistantDisabled,
}: TripDayModeQuickActionsProps) {
  const previewLinks = item ? getPlacePreviewLinks(item, location) : null;
  const websiteUrl = item ? getWebsiteUrl(item, location) : null;
  const mapsUrl = item ? getPlaceMapsUrlOrNull(item, location) : null;

  const openMaps = () => {
    if (!item || !mapsUrl) return;
    void openUrl(mapsUrl);
  };

  const openWebsite = () => {
    if (websiteUrl) {
      void openUrl(websiteUrl);
      return;
    }
    if (!previewLinks) return;
    void openUrl(`https://www.google.com/search?q=${encodeURIComponent(previewLinks.query + ' 公式')}`);
  };

  const openInstagram = () => {
    if (!previewLinks) return;
    void openSocialSearchLink({
      type: 'instagram',
      query: previewLinks.query,
      primaryUrl: previewLinks.instagram,
    });
  };

  const openTikTok = () => {
    if (!previewLinks) return;
    void openSocialSearchLink({
      type: 'tiktok',
      query: previewLinks.query,
      primaryUrl: previewLinks.tiktok,
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>クイックアクション</Text>
      <View style={styles.grid}>
        <ActionButton label="Google Mapsで開く" onPress={openMaps} disabled={!item || !mapsUrl} />
        <ActionButton label="公式サイト" onPress={openWebsite} disabled={!item} />
        <ActionButton
          label="Instagramで見る"
          onPress={openInstagram}
          disabled={!previewLinks}
        />
        <ActionButton label="TikTokで見る" onPress={openTikTok} disabled={!previewLinks} />
        <ActionButton label="この予定を変更" onPress={onEditItem} disabled={!item} />
        <ActionButton label="遅れてる" onPress={onDelay} variant="danger" />
        <ActionButton label="雨プランにする" onPress={onRainPlan} disabled={rainPlanDisabled} />
        <ActionButton
          label="旅行秘書に相談"
          onPress={onOpenAssistant}
          variant="primary"
          disabled={assistantDisabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
  },
  sectionTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  button: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderWidth: 1,
    borderColor: NS.colors.border,
    minWidth: '47%',
    flexGrow: 1,
  },
  buttonPrimary: {
    backgroundColor: NS.colors.coralSoft,
    borderColor: NS.colors.coral,
    borderWidth: 1.5,
  },
  buttonDanger: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonLabel: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  buttonLabelPrimary: {
    color: NS.colors.coral,
  },
  buttonLabelDanger: {
    color: NS.colors.danger,
  },
});
