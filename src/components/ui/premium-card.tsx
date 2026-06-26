import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { NS, getChipPalette, gradientStyle } from '@/constants/nanisuru-ui';
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
        <View style={styles.topAccent} />
        {children}
      </Pressable>
    );
  }

  return (
    <View style={cardStyles}>
      <View style={styles.topAccent} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.xl,
    borderWidth: 1,
    borderColor: NS.colors.border,
    overflow: 'hidden',
    ...NS.shadow.card,
  },
  cardAccent: {
    borderColor: NS.colors.accentBorder,
    backgroundColor: '#F8FBFF',
  },
  cardFlat: {
    backgroundColor: NS.colors.bgCard,
    shadowOpacity: 0,
    elevation: 0,
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: NS.colors.skySoft,
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
});

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  step?: number;
};

export function SectionHeader({ title, subtitle, eyebrow, step }: SectionHeaderProps) {
  return (
    <View style={headerStyles.wrap}>
      {eyebrow ? <Text style={headerStyles.eyebrow}>{eyebrow}</Text> : null}
      <View style={headerStyles.titleRow}>
        {step != null ? (
          <View style={headerStyles.stepBadge}>
            <Text style={headerStyles.stepText}>{step}</Text>
          </View>
        ) : null}
        <Text style={headerStyles.title}>{title}</Text>
      </View>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: NS.colors.coralSoft,
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: NS.colors.coral,
    fontSize: 14,
    fontWeight: '900',
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.headline,
    flex: 1,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    marginTop: Spacing.one,
    lineHeight: 22,
  },
});

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'warm' | 'mint';
};

const VARIANT_SOLID_BACKGROUND: Record<NonNullable<PrimaryButtonProps['variant']>, string> = {
  primary: NS.colors.accent,
  secondary: NS.colors.bgElevated,
  warm: NS.colors.orange,
  mint: NS.colors.mint,
};

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
}: PrimaryButtonProps) {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) return null;

  const gradientKey =
    variant === 'warm'
      ? 'warmButton'
      : variant === 'mint'
        ? 'mintButton'
        : variant === 'primary'
          ? 'primaryButton'
          : null;

  const isSecondary = variant === 'secondary';

  return (
    <Pressable
      style={({ pressed }) => [
        buttonStyles.base,
        { backgroundColor: VARIANT_SOLID_BACKGROUND[variant] },
        gradientKey ? gradientStyle(gradientKey) : null,
        variant === 'warm' ? NS.shadow.pop : null,
        isSecondary && buttonStyles.secondary,
        !isSecondary && variant !== 'warm' && buttonStyles.primaryShadow,
        disabled && buttonStyles.disabled,
        pressed && !disabled && buttonStyles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={trimmedLabel}>
      <View style={buttonStyles.shine} pointerEvents="none" />
      <Text
        style={[
          buttonStyles.label,
          isSecondary && buttonStyles.labelSecondary,
        ]}>
        {trimmedLabel}
      </Text>
    </Pressable>
  );
}

const buttonStyles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    borderRadius: NS.radius.lg,
    paddingVertical: 18,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    overflow: 'hidden',
  },
  primaryShadow: {
    ...NS.shadow.accent,
  },
  secondary: {
    borderWidth: 1.5,
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
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  label: {
    color: NS.colors.textOnAccent,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
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
  colorIndex?: number;
};

export function SelectChip({
  label,
  selected,
  onPress,
  width = '48%',
  colorIndex = 0,
}: SelectChipProps) {
  const palette = getChipPalette(colorIndex);

  return (
    <Pressable
      style={({ pressed }) => [
        chipStyles.chip,
        { width },
        selected && {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
        pressed && chipStyles.chipPressed,
      ]}
      onPress={onPress}>
      <Text
        style={[
          chipStyles.label,
          selected && { color: palette.text, fontWeight: '800' },
        ]}>
        {label}
      </Text>
      {selected ? <View style={[chipStyles.dot, { backgroundColor: palette.dot }]} /> : null}
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    backgroundColor: NS.colors.bgElevated,
    borderColor: NS.colors.border,
    borderWidth: 1,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...NS.shadow.card,
  },
  chipPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  label: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: Spacing.two,
  },
});
