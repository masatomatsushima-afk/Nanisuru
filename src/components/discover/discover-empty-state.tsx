import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type DiscoverEmptyStateProps = {
  title: string;
  description: string;
  buttonLabel?: string;
  onAction?: () => void;
  emoji?: string;
};

export function DiscoverEmptyState({
  title,
  description,
  buttonLabel,
  onAction,
  emoji = '✨',
}: DiscoverEmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {buttonLabel && onAction ? (
        <View style={styles.buttonWrap}>
          <PrimaryButton label={buttonLabel} onPress={onAction} variant="warm" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.xl,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.five,
    gap: Spacing.two,
    marginVertical: Spacing.two,
    ...NS.shadow.card,
    shadowOpacity: 0.05,
  },
  emoji: {
    fontSize: 36,
  },
  title: {
    color: NS.colors.text,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  description: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  buttonWrap: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: Spacing.one,
  },
});
