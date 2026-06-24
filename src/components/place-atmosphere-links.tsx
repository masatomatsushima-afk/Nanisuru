import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { getPlacePreviewLinks } from '@/lib/place-preview-links';
import type { ItineraryItem } from '@/types/plan';

type PlaceAtmosphereLinksProps = {
  item: ItineraryItem;
  location?: string;
};

type PreviewButtonProps = {
  label: string;
  onPress: () => void;
};

function PreviewButton({ label, onPress }: PreviewButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={onPress}>
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

async function openExternalUrl(url: string): Promise<void> {
  await Linking.openURL(url);
}

export function PlaceAtmosphereLinks({ item, location }: PlaceAtmosphereLinksProps) {
  const links = getPlacePreviewLinks(item, location);

  const handleOpen = (url: string) => {
    void openExternalUrl(url);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>雰囲気をチェック</Text>
      <View style={styles.row}>
        <PreviewButton
          label="Instagramで見る"
          onPress={() => handleOpen(links.instagram)}
        />
        <PreviewButton label="TikTokで見る" onPress={() => handleOpen(links.tiktok)} />
        <PreviewButton
          label="Google画像で見る"
          onPress={() => handleOpen(links.googleImages)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  sectionLabel: {
    color: NS.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  button: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.sm,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.88,
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  buttonLabel: {
    color: NS.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
});
