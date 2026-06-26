import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { APP_MESSAGES } from '@/lib/app-errors';

type EmptyStateCardProps = {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'flat';
};

export function EmptyStateCard({
  icon = '📭',
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
}: EmptyStateCardProps) {
  return (
    <PremiumCard variant={variant === 'flat' ? 'flat' : 'default'} style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel?.trim() && onAction ? (
        <View style={styles.actionWrap}>
          <PrimaryButton label={actionLabel.trim()} onPress={onAction} />
        </View>
      ) : null}
    </PremiumCard>
  );
}

type ErrorStateCardProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorStateCard({
  title = '読み込みに失敗しました',
  message,
  onRetry,
  retryLabel = APP_MESSAGES.retry,
}: ErrorStateCardProps) {
  return (
    <PremiumCard style={styles.card}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{message}</Text>
      {onRetry ? (
        <View style={styles.actionWrap}>
          <PrimaryButton label={retryLabel.trim() || 'もう一度試す'} onPress={onRetry} />
        </View>
      ) : null}
    </PremiumCard>
  );
}

type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = '読み込み中...' }: LoadingStateProps) {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="large" color={NS.colors.accent} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  icon: {
    fontSize: 44,
  },
  errorIcon: {
    fontSize: 32,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.headline,
    textAlign: 'center',
  },
  description: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  actionWrap: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: Spacing.one,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.three,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
  },
});
