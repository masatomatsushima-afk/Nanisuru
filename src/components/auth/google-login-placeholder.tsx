import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { showFeatureComingSoonAlert } from '@/lib/feature-unavailable';

/** Google login placeholder — shows friendly coming-soon message when tapped. */
export function GoogleLoginPlaceholder() {
  return (
    <Pressable style={styles.button} onPress={showFeatureComingSoonAlert}>
      <Text style={styles.icon}>G</Text>
      <View style={styles.textWrap}>
        <Text style={styles.label}>Googleでログイン</Text>
        <Text style={styles.note}>この機能は現在準備中です</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: NS.radius.md + 2,
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderColor: NS.colors.border,
    backgroundColor: NS.colors.bg,
  },
  icon: {
    fontSize: 18,
    fontWeight: '800',
    color: NS.colors.textMuted,
    width: 22,
    textAlign: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  note: {
    color: NS.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
});
