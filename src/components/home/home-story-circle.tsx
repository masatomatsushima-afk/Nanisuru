import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HomePhoto } from '@/components/home/home-photo';
import { HOME_LAYOUT } from '@/constants/home-layout';
import { HOME_UI } from '@/constants/home-ui';
import type { VisualTheme } from '@/lib/visual-placeholders';

const OUTER = HOME_LAYOUT.categoryOuter;
const PHOTO = HOME_LAYOUT.categoryPhoto;
const RING = HOME_LAYOUT.storyRing;

type HomeStoryCircleProps = {
  label: string;
  labelColor: string;
  ringColor: string;
  onPress: () => void;
  theme?: VisualTheme;
  imageUrl?: string;
  children?: ReactNode;
};

export function HomeStoryCircle({
  label,
  labelColor,
  ringColor,
  onPress,
  theme,
  imageUrl,
  children,
}: HomeStoryCircleProps) {
  return (
    <Pressable style={({ pressed }) => [styles.item, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.halo, { backgroundColor: `${ringColor}18` }]}>
        <View style={[styles.ring, { borderColor: ringColor }]}>
          <View style={styles.gap}>
            {children ??
              (theme ? (
                <HomePhoto
                  width={PHOTO}
                  height={PHOTO}
                  theme={theme}
                  imageUrl={imageUrl}
                  borderRadius={PHOTO / 2}
                />
              ) : null)}
          </View>
        </View>
      </View>
      <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    width: OUTER + 2,
    gap: 4,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  halo: {
    borderRadius: (OUTER + 10) / 2,
    padding: 3,
  },
  ring: {
    width: OUTER,
    height: OUTER,
    borderRadius: OUTER / 2,
    borderWidth: RING,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    ...HOME_UI.shadow.photo,
    shadowOpacity: 0.07,
  },
  gap: {
    width: PHOTO + 2,
    height: PHOTO + 2,
    borderRadius: (PHOTO + 2) / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    ...HOME_UI.type.storyLabel,
    textAlign: 'center',
    maxWidth: OUTER + 8,
  },
});
