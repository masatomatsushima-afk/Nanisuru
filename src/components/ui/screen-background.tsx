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
    backgroundColor: NS.colors.bg,
    ...(Platform.OS !== 'web'
      ? {
          opacity: 0.15,
        }
      : {}),
  },
  content: {
    flex: 1,
  },
});
