import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type ProfileEmptyStateProps = {
  emoji: string;
  title: string;
  description?: string;
  buttonLabel?: string;
  onAction?: () => void;
};

export function ProfileEmptyState({
  emoji,
  title,
  description,
  buttonLabel,
  onAction,
}: ProfileEmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
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
    fontSize: 32,
  },
  title: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  description: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 260,
  },
  buttonWrap: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: Spacing.one,
  },
});
