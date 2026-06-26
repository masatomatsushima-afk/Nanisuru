import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import {
  getVisualPreset,
  getVisualPresetFromSeed,
  type VisualTheme,
} from '@/lib/visual-placeholders';

type VisualCoverProps = {
  height: number;
  imageUrl?: string | null;
  theme?: VisualTheme;
  seed?: string | number;
  category?: string;
  borderRadius?: number;
  overlay?: 'none' | 'soft' | 'bottom' | 'full';
  showEmoji?: boolean;
  imageTintOpacity?: number;
  contentLayout?: 'bottom' | 'fill';
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function VisualCover({
  height,
  imageUrl,
  theme,
  seed,
  category,
  borderRadius = 0,
  overlay = 'bottom',
  showEmoji = true,
  imageTintOpacity,
  contentLayout = 'bottom',
  style,
  children,
}: VisualCoverProps) {
  const preset =
    seed != null
      ? getVisualPresetFromSeed(seed, theme ?? 'travel')
      : getVisualPreset(category ?? theme ?? 'travel');
  const hasCustomImage = Boolean(imageUrl?.trim());
  const resolvedUrl = hasCustomImage ? imageUrl!.trim() : preset.imageUrl;
  const tintOpacity = imageTintOpacity ?? (showEmoji ? 0.22 : 0.05);

  return (
    <View
      style={[
        styles.root,
        { height, borderRadius, backgroundColor: preset.gradientStart },
        style,
      ]}>
      <Image source={{ uri: resolvedUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />

      {!hasCustomImage && tintOpacity > 0 ? (
        <View style={[styles.fallbackTint, { backgroundColor: preset.gradientStart, opacity: tintOpacity }]} />
      ) : null}

      {showEmoji && !hasCustomImage ? (
        <Text style={[styles.emoji, { top: height * 0.22 }]}>{preset.emoji}</Text>
      ) : null}

      {showEmoji ? (
        <>
          <View style={[styles.blob, styles.blobTop, { backgroundColor: preset.accentGlow }]} />
          <View style={[styles.blob, styles.blobBottom, { backgroundColor: preset.accentGlow }]} />
        </>
      ) : null}

      {overlay === 'soft' ? <View style={styles.overlaySoft} /> : null}
      {overlay === 'bottom' ? <View style={styles.overlayBottom} /> : null}
      {overlay === 'full' ? <View style={styles.overlayFull} /> : null}

      {children ? (
        <View
          style={[
            styles.content,
            contentLayout === 'fill' && styles.contentFill,
          ]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    backgroundColor: NS.colors.bgInput,
    position: 'relative',
  },
  fallbackTint: {
    ...StyleSheet.absoluteFill,
  },
  emoji: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 34,
    zIndex: 1,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobTop: {
    width: 90,
    height: 90,
    top: -24,
    right: -18,
  },
  blobBottom: {
    width: 72,
    height: 72,
    bottom: -20,
    left: -12,
  },
  overlaySoft: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  overlayBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '48%',
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
  },
  overlayFull: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  content: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    padding: 10,
    zIndex: 2,
  },
  contentFill: {
    justifyContent: 'flex-start',
  },
});
