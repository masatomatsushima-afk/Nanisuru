import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PremiumCard } from '@/components/ui/premium-card';
import { ScreenBackground } from '@/components/ui/screen-background';
import { FadeInView } from '@/components/ui/fade-in-view';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { LOOP_TEST_RESTORE, loopTestLogOnce } from '@/lib/loop-test-config';

const MVP_NOTICE =
  'アカウント機能や旅行の好み保存は今後アップデート予定です';

type ProfileMenuItem = {
  icon: string;
  label: string;
  hint: string;
  onPress?: () => void;
  disabled?: boolean;
};

const MENU_ITEMS: ProfileMenuItem[] = [
  {
    icon: '🗺️',
    label: '作成したプラン',
    hint: 'ホームで旅行プランを作成できます',
    onPress: () => router.push('/(tabs)'),
  },
  {
    icon: '📌',
    label: '保存済み',
    hint: '保存したプランを見返せます',
    onPress: () => router.push('/(tabs)/favorites'),
  },
  {
    icon: '✨',
    label: '旅行の好み',
    hint: '準備中',
    disabled: true,
  },
  {
    icon: '⚙️',
    label: 'アプリ設定',
    hint: '準備中',
    disabled: true,
  },
];

function ProfileMenuRow({ item }: { item: ProfileMenuItem }) {
  const disabled = item.disabled ?? !item.onPress;

  const content = (
    <View style={[styles.menuRow, disabled && styles.menuRowDisabled]}>
      <View style={styles.menuIconWrap}>
        <Text style={styles.menuIcon}>{item.icon}</Text>
      </View>
      <View style={styles.menuTextWrap}>
        <Text style={[styles.menuLabel, disabled && styles.menuLabelDisabled]}>{item.label}</Text>
        <Text style={styles.menuHint}>{item.hint}</Text>
      </View>
      {!disabled ? <Text style={styles.menuChevron}>→</Text> : null}
    </View>
  );

  if (disabled || !item.onPress) {
    return content;
  }

  return (
    <Pressable
      style={({ pressed }) => [pressed && styles.menuRowPressed]}
      onPress={item.onPress}
      accessibilityRole="button"
      accessibilityLabel={item.label}>
      {content}
    </Pressable>
  );
}

// MVP static screen only: no Supabase / OpenAI calls, no fetch, no useEffect on mount.
function ProfileMvpScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScreenBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.four,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.five,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <FadeInView>
          <Text style={styles.eyebrow}>👤 MY PAGE</Text>
          <Text style={styles.title}>マイページ</Text>
          <Text style={styles.subtitle}>旅行プランや設定を管理できます</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MVP準備中</Text>
          </View>
        </FadeInView>

        <FadeInView delay={60}>
          <PremiumCard style={styles.menuCard}>
            <View style={styles.menuList}>
              {MENU_ITEMS.map((item, index) => (
                <View key={item.label}>
                  {index > 0 ? <View style={styles.menuDivider} /> : null}
                  <ProfileMenuRow item={item} />
                </View>
              ))}
            </View>
          </PremiumCard>
        </FadeInView>

        <FadeInView delay={120}>
          <PremiumCard variant="flat" style={styles.noticeCard}>
            <Text style={styles.noticeText}>{MVP_NOTICE}</Text>
          </PremiumCard>
        </FadeInView>
      </ScrollView>
    </ScreenBackground>
  );
}

export default function ProfileScreen() {
  if (LOOP_TEST_RESTORE.screenProfile) {
    loopTestLogOnce('restore:Profile', 'restoring Profile / マイページ');
    const ProfileScreenReal = require('@/archive/loop-test/tabs/profile.real').default;
    return <ProfileScreenReal />;
  }

  loopTestLogOnce('screen:Profile', 'MVP static profile screen');
  return <ProfileMvpScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: NS.layout.screenPadding,
    maxWidth: NS.layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.two,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.title,
    marginBottom: Spacing.two,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    marginBottom: Spacing.three,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: NS.colors.warningSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    marginBottom: Spacing.five,
  },
  badgeText: {
    color: NS.colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  menuCard: {
    padding: Spacing.three,
    marginBottom: Spacing.four,
  },
  menuList: {
    gap: 0,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
    minHeight: 64,
  },
  menuRowDisabled: {
    opacity: 0.55,
  },
  menuRowPressed: {
    opacity: 0.88,
  },
  menuIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NS.colors.skySoft,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 20,
  },
  menuTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  menuLabel: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  menuLabelDisabled: {
    color: NS.colors.textSecondary,
  },
  menuHint: {
    color: NS.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  menuChevron: {
    color: NS.colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  menuDivider: {
    height: 1,
    backgroundColor: NS.colors.border,
    marginHorizontal: Spacing.one,
  },
  noticeCard: {
    marginBottom: Spacing.four,
  },
  noticeText: {
    color: NS.colors.textMuted,
    ...NS.typography.bodySm,
    textAlign: 'center',
    lineHeight: 22,
  },
});
