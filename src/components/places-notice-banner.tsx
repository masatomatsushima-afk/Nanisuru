import { StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type PlacesNoticeBannerProps = {
  message: string;
};

export function PlacesNoticeBanner({ message }: PlacesNoticeBannerProps) {
  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>ℹ️</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  icon: {
    fontSize: 16,
    marginTop: 1,
  },
  text: {
    flex: 1,
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
});
