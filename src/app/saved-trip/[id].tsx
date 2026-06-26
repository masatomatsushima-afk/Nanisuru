import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

import { AddTripSecretaryFolderButton } from '@/components/add-trip-secretary-folder-button';
import { AfterPlanLaunchButton } from '@/components/after-plan-launch-button';
import { AiAdviceSection } from '@/components/ai-advice-section';
import { TripMemoryPanel } from '@/components/trip-memory-panel';
import { BudgetBreakdownSection } from '@/components/budget-breakdown-section';
import { ConciergeAccessSection } from '@/components/concierge-access-section';
import { ConciergeAnalysisSection } from '@/components/concierge-analysis-section';
import { ItineraryDaysView } from '@/components/itinerary-days-view';
import { ItineraryItemEditSheet } from '@/components/itinerary-item-edit-sheet';
import { InspiredByCredit } from '@/components/inspired-by-credit';
import { CurrentLocationButton } from '@/components/current-location-button';
import { PublishPlanSheet } from '@/components/publish-plan-sheet';
import { RequireAuthGate } from '@/components/require-auth-gate';
import { ErrorStateCard } from '@/components/ui/state-cards';
import { PrimaryButton } from '@/components/ui/premium-card';
import { WeatherSection } from '@/components/weather-section';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getDurationDisplayLabel } from '@/lib/trip-duration';
import { COMPANION_SUBTITLES, PERSONALITY_SUBTITLES } from '@/lib/itineraries';
import { formatSavedTripDate, formatTripSchedule, getTripById, updateTrip } from '@/lib/saved-trips';
import { ShareTripSection } from '@/components/share-trip-section';
import { getPublishedPlanForTrip, deletePublicPlan, stopPublicPlan } from '@/lib/public-plans';
import { MODERATION_STATUS_LABELS } from '@/types/moderation';
import { buildActiveTripContext, saveActiveTrip } from '@/lib/active-trip';
import { getActionErrorMessage } from '@/lib/app-errors';
import { saveItineraryEdit } from '@/lib/itinerary-edits';
import { applyPartialEditResult } from '@/lib/itinerary-partial-edit';
import { buildItineraryItemId } from '@/types/itinerary-edit';
import type { ItineraryEditTarget, PartialItineraryEditResult } from '@/types/itinerary-edit';

import type { SavedTrip } from '@/types/trip';
import type { PublicPlan } from '@/types/public-plan';

const accent = NS.colors.accent;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function SavedTripDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isLoading: authLoading } = useAuth();
  const [trip, setTrip] = useState<SavedTrip | null>(null);
  const [publishedPlan, setPublishedPlan] = useState<PublicPlan | null>(null);
  const [showPublishSheet, setShowPublishSheet] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isModerating, setIsModerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrip = useCallback(async () => {
    if (!id || !session) return;

    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getTripById(id);
      if (!loaded) {
        setError('プランが見つかりませんでした');
        setTrip(null);
        return;
      }
      setTrip(loaded);
      setPublishedPlan(await getPublishedPlanForTrip(loaded.id));
      await saveActiveTrip(
        buildActiveTripContext({
          location: loaded.payload.location,
          budget: loaded.payload.budget,
          currency: loaded.payload.currency,
          people: loaded.payload.people,
          mood: loaded.payload.mood,
          companion: loaded.payload.companion,
          personality: loaded.payload.personality,
          tripDuration: loaded.payload.tripDuration,
          days: loaded.payload.days,
          details: loaded.payload.details,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'プランの読み込みに失敗しました';
      setError(message);
      setTrip(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, session]);

  useEffect(() => {
    if (authLoading || !session) return;
    void loadTrip();
  }, [authLoading, session, loadTrip]);

  return (
    <RequireAuthGate
      title="保存済みプランを見るにはログインが必要です"
      description="あなたのプランはアカウントに安全に保存されています。ログインして確認してください。"
      loadingMessage="確認中...">
      {authLoading || isLoading ? (
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={styles.loadingText}>プランを読み込み中...</Text>
        </View>
      ) : error || !trip ? (
        <View style={[styles.centered, styles.container, { paddingTop: insets.top + Spacing.four }]}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← 戻る</Text>
          </Pressable>
          <ErrorStateCard
            title="プランを読み込めませんでした"
            message={error ?? 'プランが見つかりませんでした'}
            onRetry={() => void loadTrip()}
          />
          <Pressable onPress={() => router.replace('/favorites')}>
            <Text style={styles.linkText}>保存済みプラン一覧へ</Text>
          </Pressable>
        </View>
      ) : (
        <SavedTripDetailContent
          trip={trip}
          onTripUpdated={setTrip}
          publishedPlan={publishedPlan}
          setPublishedPlan={setPublishedPlan}
          showPublishSheet={showPublishSheet}
          setShowPublishSheet={setShowPublishSheet}
          isModerating={isModerating}
          setIsModerating={setIsModerating}
          insets={insets}
        />
      )}
    </RequireAuthGate>
  );
}

function SavedTripDetailContent({
  trip,
  onTripUpdated,
  publishedPlan,
  setPublishedPlan,
  showPublishSheet,
  setShowPublishSheet,
  isModerating,
  setIsModerating,
  insets,
}: {
  trip: SavedTrip;
  onTripUpdated: (trip: SavedTrip) => void;
  publishedPlan: PublicPlan | null;
  setPublishedPlan: (plan: PublicPlan | null) => void;
  showPublishSheet: boolean;
  setShowPublishSheet: (value: boolean) => void;
  isModerating: boolean;
  setIsModerating: (value: boolean) => void;
  insets: { top: number; bottom: number };
}) {
  const { session, isConfigured } = useAuth();
  const { payload } = trip;
  const { details } = payload;
  const days = payload.days?.length > 0 ? payload.days : [];
  const [editTarget, setEditTarget] = useState<ItineraryEditTarget | null>(null);
  const [showEditSheet, setShowEditSheet] = useState(false);

  const handleEditItem = (target: ItineraryEditTarget) => {
    setEditTarget(target);
    setShowEditSheet(true);
  };

  const handleApplyEdit = async (result: PartialItineraryEditResult, editRequest: string) => {
    const nextPayload = applyPartialEditResult(payload, result);
    const updated = await updateTrip(trip.id, nextPayload);
    onTripUpdated(updated);

    await saveItineraryEdit({
      tripId: trip.id,
      dayIndex: editTarget?.dayIndex ?? 0,
      itemId: editTarget ? buildItineraryItemId(editTarget) : '',
      editRequest,
      beforeData: {
        day: result.preview.beforeDay,
        item: result.preview.beforeItem,
      },
      afterData: {
        day: result.preview.afterDay,
        item: result.preview.afterItem,
      },
    });

    await saveActiveTrip(
      buildActiveTripContext({
        location: nextPayload.location,
        budget: nextPayload.budget,
        currency: nextPayload.currency,
        people: nextPayload.people,
        mood: nextPayload.mood,
        companion: nextPayload.companion,
        personality: nextPayload.personality,
        tripDuration: nextPayload.tripDuration,
        days: nextPayload.days,
        details: nextPayload.details,
      }),
    );
  };

  const runModeration = async (action: () => Promise<void>) => {
    setIsModerating(true);
    try {
      await action();
    } finally {
      setIsModerating(false);
    }
  };

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
        <Text style={styles.backButtonText}>← 保存済みプラン</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.savedBadge}>
          <Text style={styles.savedBadgeText}>保存済みプラン</Text>
        </View>
        <Text style={styles.title}>{trip.title}</Text>
        <View style={styles.tagRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{payload.personality}</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{payload.companion}</Text>
          </View>
          <View style={styles.tagMuted}>
            <Text style={styles.tagMutedText}>
              {getDurationDisplayLabel(payload.tripDuration, payload.customDuration)}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>{PERSONALITY_SUBTITLES[payload.personality]}</Text>
        <Text style={styles.companionNote}>{COMPANION_SUBTITLES[payload.companion]}</Text>
      </View>

      {payload.copyMetadata ? (
        <View style={styles.creditWrap}>
          <InspiredByCredit
            metadata={payload.copyMetadata}
            onPressCreator={
              payload.copyMetadata.sourcePublicPlanId.startsWith('sample:')
                ? undefined
                : () =>
                    router.push(`/creator/${payload.copyMetadata!.sourceCreatorUserId}`)
            }
          />
          <PrimaryButton
            label="カスタム編集を続ける"
            variant="secondary"
            onPress={() => router.push(`/plan-copy/${trip.id}`)}
          />
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>📍 場所</Text>
        <Text style={styles.sectionBody}>{payload.location.trim() || '未指定'}</Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>📅 日程</Text>
        <Text style={styles.sectionBody}>{formatTripSchedule(trip)}</Text>
        {payload.mood ? (
          <Text style={styles.moodText}>気分：{payload.mood}</Text>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>💰 予算</Text>
        <View style={styles.budgetHero}>
          <Text style={styles.budgetLabel}>合計予算</Text>
          <Text style={styles.budgetValue}>{details.totalBudget}</Text>
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
            <AfterPlanLaunchButton location={payload.location} baseTripId={trip.id} />
            <CurrentLocationButton compact />
            <ItineraryDaysView
              days={days}
              variant="detail"
              location={payload.location}
              editable
              onEditItem={handleEditItem}
              transportContext={{
                location: payload.location,
                weather: details.weather,
                travelTiming: details.travelTiming,
                companion: payload.companion,
                budget: payload.budget,
              }}
            />
          </>
        ) : (
          <Text style={styles.emptySectionText}>行程データがありません</Text>
        )}
      </View>

      {session ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🛎 旅行秘書</Text>
          <AddTripSecretaryFolderButton variant="saved-trip" trip={trip} />
        </View>
      ) : null}

      {session ? (
        <View style={styles.sectionCard}>
          <TripMemoryPanel
            trip={trip}
            userId={session.user.id}
            isConfigured={isConfigured}
            compact
          />
        </View>
      ) : null}

      {details.aiAdvice ? (
        <View style={styles.adviceWrap}>
          <AiAdviceSection advice={details.aiAdvice} />
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>🎫 予約・アクセス</Text>
        {days.length > 0 ? (
          <ConciergeAccessSection
            days={days}
            location={payload.location}
            compact
            transportContext={{
              location: payload.location,
              weather: details.weather,
              travelTiming: details.travelTiming,
              companion: payload.companion,
              budget: payload.budget,
            }}
          />
        ) : (
          <Text style={styles.emptySectionText}>予約・アクセス情報がありません</Text>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>🌍 コミュニティ公開</Text>
        <Text style={styles.publishLead}>
          発見タブに投稿して、他のユーザーとプランを共有できます。
        </Text>
        {publishedPlan?.visibility === 'public' && publishedPlan.isPublic && !publishedPlan.isRemoved ? (
          <Text style={styles.publishStatus}>公開中 · ♥ {publishedPlan.likeCount}</Text>
        ) : publishedPlan && !publishedPlan.isRemoved ? (
          <Text style={styles.publishStatusMuted}>
            {publishedPlan.visibility === 'unlisted' ? 'リンクのみ公開中' : '非公開'}
          </Text>
        ) : publishedPlan?.isRemoved ? (
          <Text style={styles.publishStatusMuted}>公開から削除済み</Text>
        ) : null}
        {publishedPlan && publishedPlan.moderationStatus !== 'active' ? (
          <Text style={styles.publishStatusMuted}>
            ステータス: {MODERATION_STATUS_LABELS[publishedPlan.moderationStatus]}
          </Text>
        ) : null}
        <PrimaryButton
          label="このプランを公開する"
          onPress={() => setShowPublishSheet(true)}
        />
        {publishedPlan && !publishedPlan.isRemoved ? (
          <>
            {publishedPlan.isPublic ? (
              <Pressable
                style={[styles.moderationButton, isModerating && styles.moderationButtonDisabled]}
                disabled={isModerating}
                onPress={() => {
                  Alert.alert(
                    '公開を停止',
                    'このプランを非公開に戻します。発見タブからは表示されなくなります。',
                    [
                      { text: 'キャンセル', style: 'cancel' },
                      {
                        text: '公開を停止する',
                        onPress: () => {
                          void runModeration(async () => {
                            try {
                              const updated = await stopPublicPlan(publishedPlan.id);
                              setPublishedPlan(updated);
                              Alert.alert('非公開にしました', 'プランは非公開に戻りました。');
                            } catch (error) {
                              Alert.alert(
                                'エラー',
                                getActionErrorMessage(error, '公開の停止に失敗しました'),
                              );
                            }
                          });
                        },
                      },
                    ],
                  );
                }}>
                <Text style={styles.moderationButtonText}>
                  {isModerating ? '処理中...' : '公開を停止する'}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.moderationButton, isModerating && styles.moderationButtonDisabled]}
                disabled={isModerating}
                onPress={() => {
                  Alert.alert(
                    '非公開に戻す',
                    'このプランを非公開に戻します。',
                    [
                      { text: 'キャンセル', style: 'cancel' },
                      {
                        text: '非公開に戻す',
                        onPress: () => {
                          void runModeration(async () => {
                            try {
                              const updated = await stopPublicPlan(publishedPlan.id);
                              setPublishedPlan(updated);
                            } catch (error) {
                              Alert.alert(
                                'エラー',
                                getActionErrorMessage(error, '非公開への変更に失敗しました'),
                              );
                            }
                          });
                        },
                      },
                    ],
                  );
                }}>
                <Text style={styles.moderationButtonText}>
                  {isModerating ? '処理中...' : '非公開に戻す'}
                </Text>
              </Pressable>
            )}
            <Pressable
              style={[
                styles.moderationButton,
                styles.moderationButtonDanger,
                isModerating && styles.moderationButtonDisabled,
              ]}
              disabled={isModerating}
              onPress={() => {
                Alert.alert(
                  '公開プランを削除',
                  'この公開プランを削除しますか？この操作は元に戻せません。',
                  [
                    { text: 'キャンセル', style: 'cancel' },
                    {
                      text: '削除する',
                      style: 'destructive',
                      onPress: () => {
                        void runModeration(async () => {
                          try {
                            await deletePublicPlan(publishedPlan.id);
                            setPublishedPlan(null);
                            Alert.alert('削除しました', '公開プランを削除しました。');
                          } catch (error) {
                            Alert.alert(
                              'エラー',
                              getActionErrorMessage(error, '削除に失敗しました'),
                            );
                          }
                        });
                      },
                    },
                  ],
                );
              }}>
              <Text style={[styles.moderationButtonText, styles.moderationButtonTextDanger]}>
                {isModerating ? '処理中...' : '公開プランを削除'}
              </Text>
            </Pressable>
          </>
        ) : null}
        {publishedPlan?.visibility === 'public' && publishedPlan.isPublic && !publishedPlan.isRemoved ? (
          <Pressable
            style={styles.viewPublicLink}
            onPress={() => router.push(`/public-plan/${publishedPlan.id}`)}>
            <Text style={styles.viewPublicLinkText}>公開ページを見る →</Text>
          </Pressable>
        ) : null}
      </View>

      <PublishPlanSheet
        visible={showPublishSheet}
        trip={trip}
        onClose={() => setShowPublishSheet(false)}
        onPublished={() => {
          void getPublishedPlanForTrip(trip.id).then(setPublishedPlan);
        }}
      />

      <ItineraryItemEditSheet
        visible={showEditSheet}
        target={editTarget}
        payload={payload}
        onClose={() => {
          setShowEditSheet(false);
          setEditTarget(null);
        }}
        onApply={handleApplyEdit}
      />

      <View style={styles.shareWrap}>
        <ShareTripSection
          location={payload.location}
          budget={payload.budget}
          currency={payload.currency}
          people={payload.people}
          mood={payload.mood}
          companion={payload.companion}
          personality={payload.personality}
          tripDuration={payload.tripDuration}
          days={days}
          items={payload.items}
          details={details}
        />
      </View>

      <View style={styles.footerMeta}>
        <Text style={styles.footerMetaText}>
          保存日: {formatSavedTripDate(trip.createdAt)}
        </Text>
      </View>
    </ScrollView>
  );
}

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
    marginBottom: Spacing.four,
  },
  creditWrap: {
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  savedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    marginBottom: Spacing.two,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  savedBadgeText: {
    color: accent,
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.title,
    marginBottom: Spacing.three,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.two,
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
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  companionNote: {
    color: NS.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
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
  moodText: {
    color: accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.two,
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
  shareWrap: {
    marginBottom: Spacing.three,
  },
  publishLead: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.three,
  },
  publishStatus: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  publishStatusMuted: {
    color: NS.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  viewPublicLink: {
    marginTop: Spacing.three,
    alignSelf: 'flex-start',
  },
  viewPublicLinkText: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  moderationButton: {
    marginTop: Spacing.two,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
  },
  moderationButtonDanger: {
    backgroundColor: NS.colors.dangerSoft,
    borderColor: 'rgba(248, 113, 113, 0.2)',
  },
  moderationButtonDisabled: {
    opacity: 0.55,
  },
  moderationButtonText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  moderationButtonTextDanger: {
    color: NS.colors.danger,
  },
  footerMeta: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  footerMetaText: {
    color: NS.colors.textMuted,
    fontSize: 12,
  },
  errorText: {
    color: NS.colors.danger,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: Spacing.three,
    lineHeight: 24,
  },
  linkText: {
    color: accent,
    fontSize: 15,
    fontWeight: '700',
  },
});
