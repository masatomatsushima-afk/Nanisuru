import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AiAdviceSection } from '@/components/ai-advice-section';
import { BudgetBreakdownSection } from '@/components/budget-breakdown-section';
import { ConciergeAccessSection } from '@/components/concierge-access-section';
import { ConciergeAnalysisSection } from '@/components/concierge-analysis-section';
import { CurrentLocationButton } from '@/components/current-location-button';
import { ItineraryDaysView } from '@/components/itinerary-days-view';
import { PublicPlanActions } from '@/components/public-plan-actions';
import { PrimaryButton } from '@/components/ui/premium-card';
import { FollowButton } from '@/components/follow-button';
import { PublicPlanImageGallery } from '@/components/public-plan-image-gallery';
import { PublicPlanFeedbackSection } from '@/components/public-plan-feedback-section';
import { PublicPlanSafetySection } from '@/components/public-plan-safety-section';
import { PublicPlanRelatedVersions } from '@/components/public-plan-related-versions';
import { PublicPlanVersionCreatorSection } from '@/components/public-plan-version-creator-section';
import { PublicPlanVideoLinks } from '@/components/public-plan-video-links';
import { WeatherSection } from '@/components/weather-section';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { COMPANION_SUBTITLES, PERSONALITY_SUBTITLES } from '@/lib/itineraries';
import { getPublicPlanById } from '@/lib/public-plans';
import { copyPublicPlanForEditing } from '@/lib/plan-copy';
import {
  formatPublicPlanBudget,
  formatPublicPlanDuration,
  getPublicPlanDestination,
  type PublicPlan,
} from '@/types/public-plan';
import { isDateRelatedCompanion } from '@/types/plan';
import { getProfileInitial } from '@/types/user-profile';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function PublicPlanDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const currentUserId = session?.user.id ?? null;
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopying, setIsCopying] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    getPublicPlanById(id)
      .then((result) => {
        if (!result) {
          setNotFound(true);
          return;
        }
        setPlan(result);
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleCopyAndEdit = async () => {
    if (!plan) return;

    if (!session) {
      router.push('/login');
      return;
    }

    setIsCopying(true);
    try {
      const copied = await copyPublicPlanForEditing(plan.id);
      router.push(`/plan-copy/${copied.id}`);
    } catch (error) {
      Alert.alert(
        'エラー',
        error instanceof Error ? error.message : 'プランのコピーに失敗しました',
      );
    } finally {
      setIsCopying(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={NS.colors.accent} />
        <Text style={styles.loadingText}>公開プランを読み込み中...</Text>
      </View>
    );
  }

  if (notFound || !plan) {
    return (
      <View style={[styles.centered, styles.container, { paddingTop: insets.top + Spacing.four }]}>
        <Text style={styles.notFoundIcon}>🔍</Text>
        <Text style={styles.errorTitle}>公開プランが見つかりません</Text>
        <Text style={styles.errorText}>削除されたか、非公開に変更された可能性があります。</Text>
        <Pressable style={styles.homeButton} onPress={() => router.replace('/explore')}>
          <Text style={styles.homeButtonText}>発見タブへ戻る</Text>
        </Pressable>
      </View>
    );
  }

  const { payload } = plan;
  const { details } = payload;
  const days = payload.days?.length > 0 ? payload.days : [];
  const destination = getPublicPlanDestination(plan);
  const isCreator = currentUserId === plan.userId;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.three,
          paddingBottom: insets.bottom + Spacing.five,
        },
      ]}
      showsVerticalScrollIndicator={false}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← 発見</Text>
      </Pressable>

      <PublicPlanImageGallery
        images={plan.images}
        title={plan.title}
        category={plan.category}
        destination={destination}
        variant="detail"
      />

      <PublicPlanVideoLinks videos={plan.videos} variant="detail" />

      <View style={styles.hero}>
        <View style={styles.publicBadge}>
          <Text style={styles.publicBadgeText}>コミュニティプラン</Text>
        </View>
        <Text style={styles.title}>{plan.title}</Text>
        <View style={styles.tagRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{plan.category}</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{payload.companion}</Text>
          </View>
          <View style={styles.tagMuted}>
            <Text style={styles.tagMutedText}>{formatPublicPlanDuration(plan)}</Text>
          </View>
        </View>
        {plan.description ? <Text style={styles.description}>{plan.description}</Text> : null}
        <View style={styles.creatorSection}>
          <Pressable
            style={({ pressed }) => [styles.creatorRow, pressed && styles.creatorPressed]}
            onPress={() => router.push(`/creator/${plan.userId}`)}>
            <View style={styles.creatorAvatar}>
              <Text style={styles.creatorInitial}>
                {getProfileInitial(plan.creatorDisplayName)}
              </Text>
            </View>
            <View style={styles.creatorTextWrap}>
              <Text style={styles.creatorName}>{plan.creatorDisplayName}</Text>
              {(plan.creatorFollowerCount ?? 0) > 0 ? (
                <Text style={styles.creatorFollowers}>
                  フォロワー {plan.creatorFollowerCount}
                </Text>
              ) : null}
            </View>
          </Pressable>
          <FollowButton
            userId={plan.userId}
            isFollowing={Boolean(plan.isFollowingCreator)}
            isSelf={currentUserId === plan.userId}
            isLoggedIn={Boolean(session)}
            onRequireLogin={() => router.push('/login')}
            onFollowChange={(next) =>
              setPlan((prev) =>
                prev
                  ? {
                      ...prev,
                      isFollowingCreator: next.isFollowing,
                      creatorFollowerCount: next.followerCount,
                    }
                  : prev,
              )
            }
          />
        </View>
      </View>

      <View style={styles.actionsWrap}>
        <PrimaryButton
          label={isCopying ? 'コピー中...' : 'このプランをコピーして編集'}
          onPress={() => void handleCopyAndEdit()}
          disabled={isCopying}
        />
        <PublicPlanActions
          plan={plan}
          isLoggedIn={Boolean(session)}
          onRequireLogin={() => router.push('/login')}
          onPlanUpdate={setPlan}
          onSaved={(savedTripId) => router.push(`/saved-trip/${savedTripId}`)}
        />
      </View>

      <PublicPlanRelatedVersions publicPlanId={plan.id} currentUserId={currentUserId} />

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>📍 行き先</Text>
        <Text style={styles.sectionBody}>{destination}</Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>💰 予算</Text>
        <View style={styles.budgetHero}>
          <Text style={styles.budgetLabel}>合計予算</Text>
          <Text style={styles.budgetValue}>{formatPublicPlanBudget(plan)}</Text>
        </View>
        {payload.budget ? (
          <InfoRow label="入力予算" value={`${payload.budget} ${payload.currency}`} />
        ) : null}
        {payload.people ? <InfoRow label="人数" value={`${payload.people}人`} /> : null}
        {details.budgetBreakdown ? (
          <View style={styles.budgetBreakdownWrap}>
            <BudgetBreakdownSection breakdown={details.budgetBreakdown} compact />
          </View>
        ) : null}
      </View>

      <Text style={styles.subtitle}>{PERSONALITY_SUBTITLES[payload.personality]}</Text>
      <Text style={styles.companionNote}>{COMPANION_SUBTITLES[payload.companion]}</Text>

      {plan.tags.length > 0 ? (
        <View style={styles.tagsSection}>
          {plan.tags.map((tag) => (
            <View key={tag} style={styles.hashTag}>
              <Text style={styles.hashTagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {details.weather ? (
        <View style={styles.weatherWrap}>
          <WeatherSection weather={details.weather} />
        </View>
      ) : null}

      {details.conciergeAnalysis ? (
        <View style={styles.analysisWrap}>
          <ConciergeAnalysisSection analysis={details.conciergeAnalysis} />
        </View>
      ) : null}

      {details.plannerMessage ? (
        <View style={styles.plannerCard}>
          <Text style={styles.plannerLabel}>プランナーより</Text>
          <Text style={styles.plannerText}>{details.plannerMessage}</Text>
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>🗓 行程</Text>
        {days.length > 0 ? (
          <>
            <CurrentLocationButton compact />
            <ItineraryDaysView days={days} variant="detail" location={payload.location} />
          </>
        ) : (
          <Text style={styles.emptySectionText}>行程データがありません</Text>
        )}
      </View>

      {isDateRelatedCompanion(payload.companion) && details.aiAdvice ? (
        <View style={styles.adviceWrap}>
          <AiAdviceSection advice={details.aiAdvice} />
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>🎫 予約・アクセス</Text>
        {days.length > 0 ? (
          <ConciergeAccessSection days={days} location={payload.location} compact />
        ) : (
          <Text style={styles.emptySectionText}>予約・アクセス情報がありません</Text>
        )}
      </View>

      {isCreator ? (
        <PublicPlanVersionCreatorSection
          publicPlanId={plan.id}
          onDraftCreated={(draftPlanId) => router.push(`/plan-version-draft/${draftPlanId}`)}
        />
      ) : null}

      <PublicPlanFeedbackSection
        publicPlanId={plan.id}
        creatorUserId={plan.userId}
        currentUserId={currentUserId}
        isLoggedIn={Boolean(session)}
        onRequireLogin={() => router.push('/login')}
      />

      <PublicPlanSafetySection
        plan={plan}
        isCreator={isCreator}
        isLoggedIn={Boolean(session)}
        onRequireLogin={() => router.push('/login')}
        onPlanUpdated={setPlan}
        onPlanRemoved={() => router.replace('/explore')}
        onUserBlocked={() => router.replace('/explore')}
      />

      <View style={styles.readOnlyNote}>
        <Text style={styles.readOnlyNoteText}>閲覧専用 · 個人情報は表示されません</Text>
      </View>
    </ScrollView>
  );
}

const accent = NS.colors.accent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NS.colors.bg,
  },
  centered: {
    flex: 1,
    backgroundColor: NS.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  content: {
    paddingHorizontal: Spacing.four,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  loadingText: {
    color: NS.colors.textSecondary,
    marginTop: Spacing.three,
    fontSize: 14,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingRight: Spacing.three,
    marginBottom: Spacing.two,
  },
  backButtonText: {
    color: accent,
    fontSize: 16,
    fontWeight: '600',
  },
  hero: {
    marginBottom: Spacing.three,
  },
  publicBadge: {
    alignSelf: 'flex-start',
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    marginBottom: Spacing.two,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  publicBadgeText: {
    color: accent,
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.title,
    marginBottom: Spacing.three,
  },
  description: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: Spacing.three,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  tag: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  tagText: {
    color: accent,
    fontSize: 11,
    fontWeight: '700',
  },
  tagMuted: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  tagMutedText: {
    color: NS.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  creatorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  creatorRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minWidth: 0,
  },
  creatorPressed: {
    opacity: 0.88,
  },
  creatorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorInitial: {
    color: accent,
    fontSize: 14,
    fontWeight: '800',
  },
  creatorTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  creatorName: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  creatorFollowers: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  actionsWrap: {
    marginBottom: Spacing.four,
    gap: Spacing.three,
  },
  sectionCard: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.four,
    marginBottom: Spacing.three,
    ...NS.shadow.card,
  },
  sectionTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.three,
  },
  sectionBody: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    lineHeight: 24,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  companionNote: {
    color: NS.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.three,
  },
  tagsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  hashTag: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  hashTagText: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  budgetHero: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  budgetLabel: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  budgetValue: {
    color: NS.colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
  },
  infoLabel: {
    color: NS.colors.textSecondary,
    fontSize: 14,
  },
  infoValue: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  budgetBreakdownWrap: {
    marginTop: Spacing.two,
  },
  weatherWrap: {
    marginBottom: Spacing.three,
  },
  analysisWrap: {
    marginBottom: Spacing.three,
  },
  plannerCard: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    marginBottom: Spacing.three,
  },
  plannerLabel: {
    color: accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: Spacing.two,
  },
  plannerText: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  adviceWrap: {
    marginBottom: Spacing.three,
  },
  emptySectionText: {
    color: NS.colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  readOnlyNote: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  readOnlyNoteText: {
    color: NS.colors.textMuted,
    fontSize: 12,
  },
  notFoundIcon: {
    fontSize: 40,
    marginBottom: Spacing.three,
  },
  errorTitle: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  errorText: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  homeButton: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  homeButtonText: {
    color: accent,
    fontSize: 15,
    fontWeight: '700',
  },
});
