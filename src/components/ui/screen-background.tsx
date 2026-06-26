import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { NS, gradientStyle } from '@/constants/nanisuru-ui';

type ScreenBackgroundProps = {
  children: ReactNode;
  style?: ViewStyle;
};

export function ScreenBackground({ children, style }: ScreenBackgroundProps) {
  return (
    <View style={[styles.root, style]}>
      <View style={[styles.gradientLayer, gradientStyle('screen')]} />
      <View style={styles.blobSky} />
      <View style={styles.blobCoral} />
      <View style={styles.blobMint} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NS.colors.bg,
  },
  gradientLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: NS.colors.bgGradientTop,
    ...(Platform.OS !== 'web'
      ? {
          opacity: 0.35,
        }
      : {}),
  },
  blobSky: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: NS.colors.skySoft,
  },
  blobCoral: {
    position: 'absolute',
    top: 120,
    left: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: NS.colors.coralSoft,
  },
  blobMint: {
    position: 'absolute',
    bottom: 120,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: NS.colors.mintSoft,
  },
  content: {
    flex: 1,
  },
});
