import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

/** Google login placeholder — provider setup required in Supabase Dashboard. */
export function GoogleLoginPlaceholder() {
  return (
    <Pressable style={styles.button} disabled>
      <Text style={styles.icon}>G</Text>
      <View style={styles.textWrap}>
        <Text style={styles.label}>Googleでログイン</Text>
        <Text style={styles.note}>準備中（SupabaseでGoogle OAuthを設定してください）</Text>
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
    opacity: 0.72,
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
    color: NS.colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  note: {
    color: NS.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
});
