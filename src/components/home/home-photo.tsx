import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { VISUAL_PRESETS, type VisualTheme } from '@/lib/visual-placeholders';

type HomePhotoProps = {
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  theme: VisualTheme;
  imageUrl?: string | null;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Cached cover photo with theme gradient underlay while loading. */
export function HomePhoto({
  width,
  height,
  theme,
  imageUrl,
  borderRadius = 0,
  style,
}: HomePhotoProps) {
  const preset = VISUAL_PRESETS[theme];
  const uri = imageUrl?.trim() || preset.imageUrl;
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const showUnderlay = !loaded || failed;

  return (
    <View style={[styles.wrap, { width, height, borderRadius }, style]}>
      {showUnderlay ? (
        <>
          <View style={[styles.gradientBase, { backgroundColor: preset.gradientEnd }]} />
          <View style={[styles.gradientTop, { backgroundColor: preset.gradientStart }]} />
          {failed ? (
            <View style={styles.fallbackEmojiWrap}>
              <Text style={styles.fallbackEmoji}>{preset.emoji}</Text>
            </View>
          ) : null}
        </>
      ) : null}
      {!failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="center"
          cachePolicy="memory-disk"
          transition={200}
          recyclingKey={`${theme}-${uri}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  gradientBase: {
    ...StyleSheet.absoluteFill,
    opacity: 0.72,
  },
  gradientTop: {
    ...StyleSheet.absoluteFill,
    opacity: 0.38,
  },
  fallbackEmojiWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackEmoji: {
    fontSize: 22,
  },
});
