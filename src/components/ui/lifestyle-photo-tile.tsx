import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VisualCover } from '@/components/ui/visual-cover';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { VisualTheme } from '@/lib/visual-placeholders';

type LifestylePhotoTileProps = {
  title: string;
  subtitle?: string;
  theme: VisualTheme;
  height?: number;
  onPress: () => void;
};

export function LifestylePhotoTile({
  title,
  subtitle,
  theme,
  height = 148,
  onPress,
}: LifestylePhotoTileProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, { height }, pressed && styles.tilePressed]}
      onPress={onPress}>
      <VisualCover
        height={height}
        theme={theme}
        overlay="full"
        showEmoji={false}
        borderRadius={NS.radius.xl}>
        <View style={styles.overlay}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </VisualCover>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '48%',
    borderRadius: NS.radius.xl,
    overflow: 'hidden',
    ...NS.shadow.cardLg,
    shadowOpacity: 0.12,
  },
  tilePressed: {
    opacity: 0.96,
    transform: [{ scale: 0.985 }],
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: Spacing.three,
    gap: 3,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 19,
    textShadowColor: 'rgba(15, 23, 42, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(15, 23, 42, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
