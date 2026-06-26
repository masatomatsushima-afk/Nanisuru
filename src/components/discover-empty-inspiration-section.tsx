import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { DISCOVER_SAMPLE_PLANS, type DiscoverSamplePlan } from '@/data/discover-sample-plans';
import { copyDiscoverSamplePlanForEditing } from '@/lib/discover-sample-plans';

type DiscoverEmptyInspirationSectionProps = {
  isLoggedIn: boolean;
  onRequireLogin: () => void;
};

function formatSampleBudget(sample: DiscoverSamplePlan): string {
  return sample.payload.details.totalBudget?.trim() || `${sample.payload.budget} ${sample.payload.currency}`;
}

function formatSampleDuration(sample: DiscoverSamplePlan): string {
  return sample.payload.tripDuration || sample.payload.details.duration || '1日';
}

function SamplePlanPreviewModal({
  sample,
  visible,
  onClose,
  onEdit,
  isCopying,
}: {
  sample: DiscoverSamplePlan | null;
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  isCopying: boolean;
}) {
  const insets = useSafeAreaInsets();

  if (!sample) return null;

  const destination = sample.payload.location;
  const budget = formatSampleBudget(sample);
  const duration = formatSampleDuration(sample);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { paddingTop: insets.top + Spacing.two }]}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.modalClose}>閉じる</Text>
          </Pressable>
          <View style={styles.sampleBadge}>
            <Text style={styles.sampleBadgeText}>サンプル</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.six }]}
          showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.modalHero,
              { backgroundColor: sample.gradientStart },
            ]}>
            <View style={[styles.modalHeroGlow, { backgroundColor: sample.gradientEnd }]} />
            <Text style={styles.modalHeroEmoji}>{sample.emoji}</Text>
            <Text style={styles.modalHeroTitle}>{sample.title}</Text>
            <Text style={styles.modalHeroMeta}>
              📍 {destination} · 💰 {budget} · 🗓 {duration}
            </Text>
          </View>

          <Text style={styles.modalDescription}>{sample.description}</Text>

          <View style={styles.modalTagRow}>
            {sample.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>

          {sample.payload.details.highlights.length > 0 ? (
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>✨ ハイライト</Text>
              {sample.payload.details.highlights.map((item) => (
                <Text key={item} style={styles.modalBullet}>
                  · {item}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>📅 行程イメージ</Text>
            {sample.payload.days[0]?.items.map((item) => (
              <View key={`${item.time}-${item.activity}`} style={styles.timelineRow}>
                <Text style={styles.timelineTime}>{item.time}</Text>
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineActivity}>{item.activity}</Text>
                  {item.reason ? <Text style={styles.timelineReason}>{item.reason}</Text> : null}
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.modalNote}>
            これは Nanisuru のサンプルプランです。Supabase には保存されません。
          </Text>

          <PrimaryButton
            label={isCopying ? 'コピー中...' : '自分用に編集する'}
            onPress={onEdit}
            disabled={isCopying}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

function DiscoverSamplePlanCard({
  sample,
  index,
  onReference,
  onEdit,
  isCopying,
}: {
  sample: DiscoverSamplePlan;
  index: number;
  onReference: () => void;
  onEdit: () => void;
  isCopying: boolean;
}) {
  const destination = sample.payload.location;
  const budget = formatSampleBudget(sample);
  const duration = formatSampleDuration(sample);

  return (
    <Animated.View entering={FadeInDown.delay(index * 70).duration(420).springify()}>
      <PremiumCard style={styles.card}>
        <View style={[styles.cardHero, { backgroundColor: sample.gradientStart }]}>
          <View style={[styles.cardHeroGlow, { backgroundColor: sample.gradientEnd }]} />
          <View style={styles.cardHeroTop}>
            <View style={styles.sampleBadge}>
              <Text style={styles.sampleBadgeText}>サンプル</Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statText}>♥ {sample.previewLikeCount}</Text>
              <Text style={styles.statDivider}>·</Text>
              <Text style={styles.statText}>📌 {sample.previewSaveCount}</Text>
            </View>
          </View>
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderEmoji}>{sample.emoji}</Text>
            <Text style={styles.placeholderLabel}>イメージ</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{sample.category}</Text>
          </View>

          <Text style={styles.cardTitle}>{sample.title}</Text>

          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {destination}
            </Text>
          </View>

          <Text style={styles.cardDescription} numberOfLines={2}>
            {sample.description}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>💰 {budget}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>🗓 {duration}</Text>
            </View>
          </View>

          <View style={styles.tagRow}>
            {sample.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.secondaryAction, pressed && styles.actionPressed]}
              onPress={onReference}>
              <Text style={styles.secondaryActionText}>このプランを参考にする</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.primaryAction,
                pressed && styles.actionPressed,
                isCopying && styles.actionDisabled,
              ]}
              onPress={onEdit}
              disabled={isCopying}>
              {isCopying ? (
                <ActivityIndicator size="small" color={NS.colors.textOnAccent} />
              ) : (
                <Text style={styles.primaryActionText}>自分用に編集する</Text>
              )}
            </Pressable>
          </View>
        </View>
      </PremiumCard>
    </Animated.View>
  );
}

export function DiscoverEmptyInspirationSection({
  isLoggedIn,
  onRequireLogin,
}: DiscoverEmptyInspirationSectionProps) {
  const [previewSample, setPreviewSample] = useState<DiscoverSamplePlan | null>(null);
  const [copyingSampleId, setCopyingSampleId] = useState<string | null>(null);

  const handleEdit = async (sample: DiscoverSamplePlan) => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    setCopyingSampleId(sample.id);
    try {
      const trip = await copyDiscoverSamplePlanForEditing(sample.id);
      setPreviewSample(null);
      router.push(`/plan-copy/${trip.id}`);
    } catch (error) {
      Alert.alert(
        'コピーに失敗しました',
        error instanceof Error ? error.message : 'もう一度お試しください。',
      );
    } finally {
      setCopyingSampleId(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <PremiumCard variant="accent" style={styles.emptyHero}>
        <View style={styles.emptyHeroGlow} />
        <Text style={styles.emptyIcon}>✨</Text>
        <Text style={styles.emptyTitle}>まだ公開プランがありません</Text>
        <Text style={styles.emptyText}>
          最初の本気プランを投稿して、みんなに旅・デートのアイデアを届けましょう。
        </Text>
        <View style={styles.buttonWrap}>
          <PrimaryButton label="プランを作る" onPress={() => router.push('/')} />
        </View>
      </PremiumCard>

      <View style={styles.inspirationHeader}>
        <Text style={styles.inspirationEyebrow}>INSPIRATION</Text>
        <Text style={styles.inspirationTitle}>こんなプランが並ぶ未来</Text>
        <Text style={styles.inspirationSubtitle}>
          サンプルプランで Nanisuru の可能性をのぞいてみましょう。編集すると、あなた専用のマイプランとして保存されます。
        </Text>
      </View>

      {DISCOVER_SAMPLE_PLANS.map((sample, index) => (
        <DiscoverSamplePlanCard
          key={sample.id}
          sample={sample}
          index={index}
          isCopying={copyingSampleId === sample.id}
          onReference={() => setPreviewSample(sample)}
          onEdit={() => void handleEdit(sample)}
        />
      ))}

      <PremiumCard style={styles.publishCta}>
        <Text style={styles.publishCtaTitle}>あなたが最初の1人に</Text>
        <Text style={styles.publishCtaText}>
          プランを作って公開すれば、発見タブのこの場所にあなたの行程が表示されます。
        </Text>
        <View style={styles.buttonWrap}>
          <PrimaryButton label="プランを作る" onPress={() => router.push('/')} />
        </View>
      </PremiumCard>

      <SamplePlanPreviewModal
        sample={previewSample}
        visible={Boolean(previewSample)}
        onClose={() => setPreviewSample(null)}
        onEdit={() => {
          if (previewSample) void handleEdit(previewSample);
        }}
        isCopying={Boolean(previewSample && copyingSampleId === previewSample.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
    gap: Spacing.three,
  },
  emptyHero: {
    padding: Spacing.five,
    alignItems: 'center',
    overflow: 'hidden',
  },
  emptyHeroGlow: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: NS.colors.accentGlow,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: Spacing.two,
  },
  emptyTitle: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.two,
    letterSpacing: -0.3,
  },
  emptyText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: Spacing.four,
    maxWidth: 320,
  },
  inspirationHeader: {
    paddingHorizontal: Spacing.one,
    marginTop: Spacing.two,
  },
  inspirationEyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.one,
  },
  inspirationTitle: {
    color: NS.colors.text,
    ...NS.typography.titleSm,
    marginBottom: Spacing.two,
  },
  inspirationSubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: NS.colors.bgCard,
  },
  cardHero: {
    minHeight: 148,
    padding: Spacing.four,
    overflow: 'hidden',
  },
  cardHeroGlow: {
    position: 'absolute',
    right: -30,
    bottom: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.45,
  },
  cardHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  sampleBadge: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  sampleBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '700',
  },
  statDivider: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
  },
  placeholderEmoji: {
    fontSize: 42,
    marginBottom: Spacing.one,
  },
  placeholderLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  cardBody: {
    padding: Spacing.four,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    marginBottom: Spacing.two,
  },
  categoryBadgeText: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  cardTitle: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 28,
    marginBottom: Spacing.two,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  locationIcon: {
    fontSize: 13,
  },
  locationText: {
    flex: 1,
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  cardDescription: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.three,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  metaPill: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  metaPillText: {
    color: NS.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginBottom: Spacing.four,
  },
  tag: {
    backgroundColor: NS.colors.skySoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
  },
  tagText: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  actionRow: {
    gap: Spacing.two,
  },
  secondaryAction: {
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    backgroundColor: NS.colors.bgElevated,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryAction: {
    borderRadius: NS.radius.md,
    backgroundColor: NS.colors.accent,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryActionText: {
    color: NS.colors.textOnAccent,
    fontSize: 14,
    fontWeight: '800',
  },
  actionPressed: {
    opacity: 0.9,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  publishCta: {
    padding: Spacing.four,
    marginTop: Spacing.two,
  },
  publishCtaTitle: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: Spacing.two,
  },
  publishCtaText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.four,
  },
  buttonWrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: NS.colors.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  modalClose: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  modalContent: {
    paddingHorizontal: Spacing.four,
  },
  modalHero: {
    borderRadius: NS.radius.lg,
    padding: Spacing.five,
    overflow: 'hidden',
    marginBottom: Spacing.four,
  },
  modalHeroGlow: {
    position: 'absolute',
    right: -20,
    bottom: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.5,
  },
  modalHeroEmoji: {
    fontSize: 48,
    marginBottom: Spacing.two,
  },
  modalHeroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: Spacing.two,
    letterSpacing: -0.4,
  },
  modalHeroMeta: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    fontWeight: '600',
  },
  modalDescription: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: Spacing.three,
  },
  modalTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginBottom: Spacing.four,
  },
  modalSection: {
    marginBottom: Spacing.four,
  },
  modalSectionTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: Spacing.two,
  },
  modalBullet: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  timelineTime: {
    width: 48,
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  timelineBody: {
    flex: 1,
  },
  timelineActivity: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  timelineReason: {
    color: NS.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  modalNote: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: Spacing.four,
  },
});
