import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type PremiumCardProps = {
  children: ReactNode;
  variant?: 'default' | 'accent' | 'flat';
  style?: ViewStyle;
  onPress?: () => void;
};

export function PremiumCard({ children, variant = 'default', style, onPress }: PremiumCardProps) {
  const cardStyles = [
    styles.card,
    variant === 'accent' && styles.cardAccent,
    variant === 'flat' && styles.cardFlat,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [...cardStyles, pressed && styles.pressed]}
        onPress={onPress}>
        <View style={styles.topGlow} />
        {children}
      </Pressable>
    );
  }

  return (
    <View style={cardStyles}>
      <View style={styles.topGlow} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    overflow: 'hidden',
    ...NS.shadow.card,
  },
  cardAccent: {
    borderColor: NS.colors.accentBorder,
    backgroundColor: NS.colors.bgCard,
  },
  cardFlat: {
    backgroundColor: NS.colors.bgCard,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
});

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
};

export function SectionHeader({ title, subtitle, eyebrow }: SectionHeaderProps) {
  return (
    <View style={headerStyles.wrap}>
      {eyebrow ? <Text style={headerStyles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={headerStyles.title}>{title}</Text>
      {subtitle ? <Text style={headerStyles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.three,
  },
  eyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.one,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.headline,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    marginTop: Spacing.one,
  },
});

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
};

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
}: PrimaryButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        buttonStyles.base,
        variant === 'secondary' && buttonStyles.secondary,
        disabled && buttonStyles.disabled,
        pressed && !disabled && buttonStyles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}>
      <View style={buttonStyles.shine} />
      <Text
        style={[
          buttonStyles.label,
          variant === 'secondary' && buttonStyles.labelSecondary,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const buttonStyles = StyleSheet.create({
  base: {
    backgroundColor: NS.colors.accent,
    borderRadius: NS.radius.md + 2,
    paddingVertical: 18,
    alignItems: 'center',
    overflow: 'hidden',
    ...NS.shadow.accent,
  },
  secondary: {
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    shadowOpacity: 0,
    elevation: 0,
  },
  disabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  label: {
    color: NS.colors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  labelSecondary: {
    color: NS.colors.accent,
  },
});

type SelectChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  width?: `${number}%` | 'auto';
};

export function SelectChip({ label, selected, onPress, width = '48%' }: SelectChipProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        chipStyles.chip,
        { width },
        selected && chipStyles.chipSelected,
        pressed && chipStyles.chipPressed,
      ]}
      onPress={onPress}>
      <Text style={[chipStyles.label, selected && chipStyles.labelSelected]}>{label}</Text>
      {selected ? <View style={chipStyles.dot} /> : null}
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    backgroundColor: NS.colors.bgCard,
    borderColor: NS.colors.borderStrong,
    borderWidth: 1.5,
    borderRadius: NS.radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accent,
  },
  chipPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  label: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  labelSelected: {
    color: NS.colors.text,
    fontWeight: '700',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: NS.colors.accent,
  },
});
