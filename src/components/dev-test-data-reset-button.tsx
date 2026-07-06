import { Alert, StyleSheet, Text, View } from 'react-native';

import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { resetLocalTestData } from '@/lib/dev-test-data-reset';

export function DevTestDataResetButton() {
  if (!__DEV__) return null;

  const handlePress = () => {
    Alert.alert(
      'テストデータをリセット',
      '端末内のローカルキャッシュ（好み設定・お気に入り・進行中プランなど）を削除します。Supabase 上の保存データは変更しません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'リセット',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const cleared = await resetLocalTestData();
                Alert.alert(
                  'リセット完了',
                  `${cleared.length} 件のローカルデータを削除しました。アプリを再起動すると反映が安定します。`,
                );
              } catch {
                Alert.alert('エラー', 'リセットに失敗しました');
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <PremiumCard style={styles.card}>
      <Text style={styles.title}>開発用</Text>
      <Text style={styles.note}>
        ローカルのテストキャッシュのみ削除します（クラウドの保存プランは触りません）
      </Text>
      <View style={styles.buttonWrap}>
        <PrimaryButton label="テストデータをリセット" onPress={handlePress} variant="secondary" />
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    gap: Spacing.two,
    borderColor: NS.colors.warningSoft,
  },
  title: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  note: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  buttonWrap: {
    marginTop: Spacing.one,
  },
});
