import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { ScreenBackground } from '@/components/ui/screen-background';
import { FadeInView } from '@/components/ui/fade-in-view';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { LOOP_TEST_RESTORE, loopTestLogOnce } from '@/lib/loop-test-config';

const CAN_DO_ITEMS = [
  { icon: '🗺️', label: '旅行プランの相談' },
  { icon: '☔️', label: '雨の日プランの提案' },
  { icon: '💰', label: '予算に合わせた調整' },
  { icon: '📍', label: '近くの候補探し' },
  { icon: '✏️', label: '予定の一部変更' },
] as const;

const MVP_NOTICE =
  '今は旅行プラン作成を優先しています。旅行秘書機能は今後アップデート予定です。';

// MVP static screen only: no OpenAI / Supabase calls, no fetch, no useEffect on mount.
function TravelSecretaryMvpScreen() {
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
          <Text style={styles.eyebrow}>🧳 AI ASSISTANT</Text>
          <Text style={styles.title}>旅行秘書</Text>
          <Text style={styles.subtitle}>旅の相談や予定の調整を手伝います</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MVP準備中</Text>
          </View>
        </FadeInView>

        <FadeInView delay={60}>
          <PremiumCard style={styles.card}>
            <Text style={styles.cardTitle}>できること</Text>
            <View style={styles.list}>
              {CAN_DO_ITEMS.map((item) => (
                <View key={item.label} style={styles.listRow}>
                  <Text style={styles.listIcon}>{item.icon}</Text>
                  <Text style={styles.listLabel}>{item.label}</Text>
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

        <FadeInView delay={160}>
          <View style={styles.buttonWrap}>
            <PrimaryButton
              label="プランを作る"
              onPress={() => router.push('/(tabs)')}
            />
            <Text style={styles.buttonHint}>ホームの「旅行プラン」から作成できます</Text>
          </View>
        </FadeInView>
      </ScrollView>
    </ScreenBackground>
  );
}

export default function AiScreen() {
  if (LOOP_TEST_RESTORE.screenAi) {
    loopTestLogOnce('restore:Ai', 'restoring Ai');
    const AiScreenReal = require('@/archive/loop-test/tabs/ai.real').default;
    return <AiScreenReal />;
  }

  loopTestLogOnce('screen:Ai', 'MVP static Ai screen');
  return <TravelSecretaryMvpScreen />;
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
  card: {
    marginBottom: Spacing.four,
  },
  cardTitle: {
    color: NS.colors.text,
    ...NS.typography.titleSm,
    marginBottom: Spacing.three,
  },
  list: {
    gap: Spacing.three,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  listIcon: {
    fontSize: 18,
  },
  listLabel: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    flex: 1,
  },
  noticeCard: {
    marginBottom: Spacing.five,
  },
  noticeText: {
    color: NS.colors.textMuted,
    ...NS.typography.bodySm,
    textAlign: 'center',
  },
  buttonWrap: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  buttonHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
