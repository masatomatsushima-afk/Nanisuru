import { Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_MESSAGES } from '@/lib/app-errors';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type FeedbackVariant = 'error' | 'warning' | 'info';

type AppErrorBannerProps = {
  message: string;
  variant?: FeedbackVariant;
  onRetry?: () => void;
  retryLabel?: string;
};

const VARIANT_STYLES: Record<
  FeedbackVariant,
  { bg: string; border: string; icon: string; text: string }
> = {
  error: {
    bg: NS.colors.dangerSoft,
    border: 'rgba(248, 113, 113, 0.28)',
    icon: '⚠️',
    text: NS.colors.danger,
  },
  warning: {
    bg: 'rgba(251, 191, 36, 0.1)',
    border: 'rgba(251, 191, 36, 0.28)',
    icon: 'ℹ️',
    text: '#FBBF24',
  },
  info: {
    bg: NS.colors.accentSoft,
    border: NS.colors.accentBorder,
    icon: '💡',
    text: NS.colors.accent,
  },
};

export function AppErrorBanner({
  message,
  variant = 'error',
  onRetry,
  retryLabel = APP_MESSAGES.retry,
}: AppErrorBannerProps) {
  const palette = VARIANT_STYLES[variant];

  return (
    <View style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={styles.icon}>{palette.icon}</Text>
      <View style={styles.content}>
        <Text style={[styles.message, { color: palette.text === NS.colors.danger ? NS.colors.danger : NS.colors.textSecondary }]}>
          {message}
        </Text>
        {onRetry ? (
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}
            onPress={onRetry}>
            <Text style={styles.retryLabel}>{retryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  icon: {
    fontSize: 18,
    marginTop: 1,
  },
  content: {
    flex: 1,
    gap: Spacing.two,
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  retryPressed: {
    opacity: 0.88,
  },
  retryLabel: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
