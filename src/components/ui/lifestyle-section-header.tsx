import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type LifestyleSectionHeaderProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function LifestyleSectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: LifestyleSectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  textBlock: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  action: {
    color: NS.colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
});
