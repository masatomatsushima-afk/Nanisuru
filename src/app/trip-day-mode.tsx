import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItineraryItemEditSheet } from '@/components/itinerary-item-edit-sheet';
import { TripDayModeDelaySheet } from '@/components/trip-day-mode-delay-sheet';
import { TripDayModeItemCard } from '@/components/trip-day-mode-item-card';
import { TripDayModeQuickActions } from '@/components/trip-day-mode-quick-actions';
import { WeatherReplanPreviewSheet } from '@/components/weather-replan-preview-sheet';
import { LoadingState } from '@/components/ui/state-cards';
import { ScreenBackground } from '@/components/ui/screen-background';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { parseCurrencyCode } from '@/constants/currency';
import { useAuth } from '@/contexts/auth-context';
import { saveItineraryEdit } from '@/lib/itinerary-edits';
import { isOpenAiConfigured } from '@/lib/generate-plan';
import { applyPartialEditResult } from '@/lib/itinerary-partial-edit';
import { getTripById, updateTrip } from '@/lib/saved-trips';
import { saveWeatherReplan } from '@/lib/weather-replans';
import { getTripFolderById, getTripFolderBySavedTripId, updateTripFolderPlanPayload } from '@/lib/trip-folders';
import { parseItineraryDays, isTripDurationOption } from '@/lib/trip-duration';
import {
  buildTripDayModeAssistantContext,
  buildTripDayModeTitle,
  formatTripDayModeDate,
  getSeasonalNote,
  getWeatherNoteForItem,
  resolveCurrentAndNextItems,
  resolveTodayDayIndex,
} from '@/lib/trip-day-mode';
import { buildTripMemoriesParams } from '@/lib/trip-memories-nav';
import { buildItineraryItemId, type ItineraryEditTarget, type PartialItineraryEditResult } from '@/types/itinerary-edit';
import type { CompanionOption, ItineraryItem, PersonalityOption, PlanDetails, TripDurationOption } from '@/types/plan';
import { COMPANION_OPTIONS, PERSONALITY_OPTIONS } from '@/types/plan';
import type { SavedTripPayload } from '@/types/trip';
import type { TripDayDelayPreviewSuccess } from '@/types/trip-day-mode';
import type { WeatherReplanPreviewSuccess } from '@/types/weather-replan';

function parseBudgetIncludes(raw?: string) {
  try {
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

export default function TripDayModeScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const params = useLocalSearchParams<{
    location?: string;
    budget?: string;
    currency?: string;
    people?: string;
    mood?: string;
    companion?: string;
    personality?: string;
    tripDuration?: string;
    days?: string;
    items?: string;
    details?: string;
    savedTripId?: string;
    folderId?: string;
    tripTitle?: string;
    travelPurpose?: string;
    budgetIncludes?: string;
  }>();

  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(params.folderId && !params.days));
  const [bootError, setBootError] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(params.folderId?.trim() || null);
  const [savedTripId, setSavedTripId] = useState<string | null>(params.savedTripId?.trim() || null);
  const [tripTitle, setTripTitle] = useState<string | null>(params.tripTitle?.trim() || null);
  const [folderDepartureDate, setFolderDepartureDate] = useState<string | null>(null);

  const [companion, setCompanion] = useState<CompanionOption | null>(
    COMPANION_OPTIONS.includes(params.companion as CompanionOption)
      ? (params.companion as CompanionOption)
      : null,
  );
  const [personality, setPersonality] = useState<PersonalityOption | null>(
    PERSONALITY_OPTIONS.includes(params.personality as PersonalityOption)
      ? (params.personality as PersonalityOption)
      : null,
  );
  const [location, setLocation] = useState(params.location ?? '');
  const [budget, setBudget] = useState(params.budget ?? '');
  const [currency, setCurrency] = useState(parseCurrencyCode(params.currency));
  const [people, setPeople] = useState(params.people ?? '');
  const [mood, setMood] = useState(params.mood ?? '');
  const [travelPurpose, setTravelPurpose] = useState<string | undefined>(
    params.travelPurpose?.trim() || undefined,
  );
  const [budgetIncludes, setBudgetIncludes] = useState(parseBudgetIncludes(params.budgetIncludes));
  const [tripDuration, setTripDuration] = useState<TripDurationOption>(
    isTripDurationOption(params.tripDuration ?? '')
      ? (params.tripDuration as TripDurationOption)
      : '1日',
  );

  let initialItems: ItineraryItem[] = [];
  try {
    initialItems = params.items ? JSON.parse(params.items) : [];
  } catch {
    initialItems = [];
  }

  let initialDetails: PlanDetails | null = null;
  try {
    initialDetails = params.details ? JSON.parse(params.details) : null;
  } catch {
    initialDetails = null;
  }

  const parsedDays = parseItineraryDays(params.days, initialItems);
  const [days, setDays] = useState(parsedDays);
  const [localItems, setLocalItems] = useState(initialItems);
  const [editDetails, setEditDetails] = useState<PlanDetails | null>(initialDetails);
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [editTarget, setEditTarget] = useState<ItineraryEditTarget | null>(null);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showDelaySheet, setShowDelaySheet] = useState(false);
  const [showRainSheet, setShowRainSheet] = useState(false);

  const planDetails = editDetails ?? initialDetails;

  const applyPayloadToState = (payload: SavedTripPayload) => {
    setCompanion(payload.companion);
    setPersonality(payload.personality ?? 'のんびり');
    setLocation(payload.location);
    setBudget(payload.budget);
    setCurrency(payload.currency);
    setPeople(payload.people);
    setMood(payload.mood);
    setTravelPurpose(payload.travelPurpose);
    setBudgetIncludes(payload.budgetIncludes);
    setTripDuration(payload.tripDuration);
    setDays(payload.days);
    setLocalItems(payload.items);
    setEditDetails(payload.details);
  };

  const bootstrapFromFolder = useCallback(async () => {
    if (!params.folderId?.trim()) return;

    setIsBootstrapping(true);
    setBootError(null);

    try {
      const folder = await getTripFolderById(params.folderId.trim());
      if (!folder) {
        setBootError('旅行秘書フォルダが見つかりません');
        return;
      }

      setFolderId(folder.id);
      setTripTitle(folder.title);
      setFolderDepartureDate(folder.departureDate);

      if (folder.savedTripId) {
        setSavedTripId(folder.savedTripId);
      }

      const trip =
        folder.savedTripId && session ? await getTripById(folder.savedTripId) : null;
      const payload = trip?.payload ?? folder.planPayload;

      if (!payload?.days?.length) {
        setBootError('当日モードを表示できる予定がありません');
        return;
      }

      applyPayloadToState(payload);
    } catch (err) {
      setBootError(err instanceof Error ? err.message : '読み込みに失敗しました');
    } finally {
      setIsBootstrapping(false);
    }
  }, [params.folderId, session]);

  useEffect(() => {
    if (params.folderId && !params.days) {
      void bootstrapFromFolder();
    }
  }, [bootstrapFromFolder, params.days, params.folderId]);

  useEffect(() => {
    if (!folderId && savedTripId && session) {
      void getTripFolderBySavedTripId(savedTripId).then((folder) => {
        if (folder) {
          setFolderId(folder.id);
          setFolderDepartureDate(folder.departureDate);
          if (!tripTitle) setTripTitle(folder.title);
        }
      });
    }
  }, [folderId, savedTripId, session, tripTitle]);

  const planPayload: SavedTripPayload | null = useMemo(() => {
    if (!companion || !days.length) return null;

    return {
      location,
      budget,
      currency,
      people,
      mood,
      companion,
      personality: personality ?? 'のんびり',
      tripDuration,
      days,
      items: localItems,
      details: planDetails ?? {
        totalBudget: budget,
        duration: tripDuration,
        highlights: [],
        rainyDayAlternatives: [],
      },
      budgetIncludes,
      travelPurpose,
    };
  }, [
    budget,
    budgetIncludes,
    companion,
    currency,
    days,
    localItems,
    location,
    mood,
    people,
    personality,
    planDetails,
    travelPurpose,
    tripDuration,
  ]);

  const dayIndex = planPayload ? resolveTodayDayIndex(planPayload, folderDepartureDate) : 0;
  const todayDay = days[dayIndex];
  const todayItems = todayDay?.items ?? [];

  const snapshot = useMemo(
    () =>
      resolveCurrentAndNextItems(todayItems, {
        delayMinutes,
      }),
    [todayItems, delayMinutes],
  );

  useEffect(() => {
    if (planPayload) {
      console.log('[TripDayMode] opened', planPayload);
      console.log('[TripDayMode] current item', snapshot.currentItem);
      console.log('[TripDayMode] next item', snapshot.nextItem);
    }
  }, [planPayload, snapshot.currentItem, snapshot.nextItem]);

  const persistPlanUpdate = async (
    nextPayload: SavedTripPayload,
    meta?: {
      editRequest?: string;
      target?: ItineraryEditTarget;
      beforeItem?: ItineraryItem | null;
      afterItem?: ItineraryItem | null;
      source?: string;
    },
  ) => {
    setDays(nextPayload.days);
    setLocalItems(nextPayload.items);
    setEditDetails(nextPayload.details);

    if (savedTripId) {
      try {
        await updateTrip(savedTripId, {
          ...nextPayload,
          budgetIncludes,
          travelPurpose,
        });
      } catch {
        // Keep local state even if sync fails.
      }
    }

    if (folderId) {
      try {
        await updateTripFolderPlanPayload(folderId, nextPayload);
      } catch {
        // Keep local state even if sync fails.
      }
    }

    if (meta?.target && meta.editRequest) {
      await saveItineraryEdit({
        tripId: savedTripId ?? undefined,
        folderId: folderId ?? undefined,
        dayIndex: meta.target.dayIndex,
        itemId: buildItineraryItemId(meta.target),
        editRequest: meta.editRequest,
        beforeData: {
          item: meta.beforeItem,
          dayIndex: meta.target.dayIndex,
          itemIndex: meta.target.itemIndex,
        },
        afterData: {
          item: meta.afterItem,
          dayIndex: meta.target.dayIndex,
          itemIndex: meta.target.itemIndex,
        },
        source: meta.source ?? 'trip_day_mode',
      });
    }

    console.log('[TripDayMode] applied update', nextPayload);
  };

  const handleApplyDelay = async (nextPayload: SavedTripPayload, preview: TripDayDelayPreviewSuccess) => {
    await persistPlanUpdate(nextPayload, {
      editRequest: `遅れ調整: ${preview.changeSummary}`,
      source: 'trip_day_mode_delay',
    });
  };

  const handleApplyWeatherReplan = async (
    nextPayload: SavedTripPayload,
    preview: WeatherReplanPreviewSuccess,
  ) => {
    await persistPlanUpdate(nextPayload, {
      editRequest: '雨プランに合わせて天候再調整',
      source: 'trip_day_mode_weather',
    });

    if (savedTripId) {
      try {
        await saveWeatherReplan({
          tripId: savedTripId,
          beforePlan: preview.beforePayload,
          afterPlan: preview.afterPayload,
          weatherContext: preview.freshWeather,
        });
      } catch {
        // History is optional.
      }
    }
  };

  const handleApplyEdit = async (result: PartialItineraryEditResult, editRequest: string) => {
    if (!planPayload || !editTarget) return;
    const nextPayload = applyPartialEditResult(planPayload, result);
    await persistPlanUpdate(nextPayload, {
      editRequest,
      target: editTarget,
      beforeItem: result.preview.beforeItem,
      afterItem: result.preview.afterItem,
      source: 'trip_day_mode',
    });
    setShowEditSheet(false);
    setEditTarget(null);
  };

  const openEditForItem = (item: ItineraryItem | null, itemIndex: number | null) => {
    if (!item || itemIndex === null || !todayDay) return;

    setEditTarget({
      dayIndex,
      itemIndex,
      dayNumber: todayDay.dayNumber,
      item,
    });
    setShowEditSheet(true);
  };

  const focusItem = snapshot.currentItem ?? snapshot.nextItem;
  const focusIndex = snapshot.currentIndex ?? snapshot.nextIndex;

  const openAssistant = () => {
    if (!folderId) return;

    const dayModeContext = buildTripDayModeAssistantContext({
      snapshot,
      dayLabel: todayDay?.label ?? '今日',
      delayMinutes,
    });

    router.push({
      pathname: '/trip-assistant/[folderId]',
      params: {
        folderId,
        dayModeContext: JSON.stringify(dayModeContext),
      },
    });
  };

  const seasonalNote = getSeasonalNote(planDetails?.weather);
  const displayTitle = planPayload ? buildTripDayModeTitle(planPayload, tripTitle) : tripTitle ?? '旅行';

  if (isBootstrapping) {
    return (
      <ScreenBackground>
        <View style={[styles.centered, { paddingTop: insets.top + Spacing.five }]}>
          <LoadingState message="当日モードを準備中…" />
        </View>
      </ScreenBackground>
    );
  }

  if (bootError || !companion || !days.length || !planPayload || !todayItems.length) {
    return (
      <ScreenBackground>
        <View style={[styles.container, { paddingTop: insets.top + Spacing.four }]}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← 戻る</Text>
          </Pressable>
          <Text style={styles.emptyText}>
            {bootError ?? '当日モードを表示できる予定がありません'}
          </Text>
        </View>
      </ScreenBackground>
    );
  }

  const currentWeatherNote = snapshot.currentItem
    ? getWeatherNoteForItem(snapshot.currentItem, planDetails?.weather)
    : null;

  return (
    <ScreenBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + Spacing.six,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>当日モード</Text>
          <Text style={styles.screenTitle}>今日の予定</Text>
          <Text style={styles.tripTitle}>{displayTitle}</Text>
          <Text style={styles.date}>{formatTripDayModeDate()}</Text>
          <Text style={styles.destination}>{location}</Text>
          {seasonalNote ? <Text style={styles.weatherNote}>{seasonalNote}</Text> : null}
          {days.length > 1 && todayDay ? (
            <Text style={styles.dayLabel}>{todayDay.label}</Text>
          ) : null}
        </View>

        {snapshot.status === 'before_first' ? (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>最初の予定までの準備</Text>
            {snapshot.nextItem ? (
              <Text style={styles.statusBannerSub}>
                次は {snapshot.nextItem.time} {snapshot.nextItem.activity}
              </Text>
            ) : null}
          </View>
        ) : null}

        {snapshot.status === 'after_last' ? (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>今日の予定は完了しました</Text>
          </View>
        ) : null}

        {snapshot.currentItem ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>今の予定</Text>
            <TripDayModeItemCard
              item={snapshot.currentItem}
              variant="current"
              weatherNote={currentWeatherNote}
              location={location}
            />
          </View>
        ) : null}

        {snapshot.nextItem && snapshot.status !== 'after_last' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>次の予定</Text>
            <TripDayModeItemCard
              item={snapshot.nextItem}
              variant="next"
              location={location}
            />
          </View>
        ) : null}

        <TripDayModeQuickActions
          item={focusItem}
          location={location}
          onEditItem={() => openEditForItem(focusItem, focusIndex)}
          onDelay={() => setShowDelaySheet(true)}
          onRainPlan={() => setShowRainSheet(true)}
          onOpenAssistant={openAssistant}
          rainPlanDisabled={!isOpenAiConfigured()}
          assistantDisabled={!folderId}
        />

        {savedTripId ? (
          <Pressable
            style={({ pressed }) => [styles.memoryButton, pressed && styles.memoryButtonPressed]}
            onPress={() =>
              router.push({
                pathname: '/trip-memories',
                params: buildTripMemoriesParams({
                  savedTripId,
                  folderId,
                  linkDayIndex: focusIndex !== null ? dayIndex : undefined,
                  linkItemIndex: focusIndex,
                }),
              })
            }>
            <Text style={styles.memoryButtonText}>思い出を残す</Text>
          </Pressable>
        ) : null}

        {delayMinutes > 0 ? (
          <Text style={styles.delayStatus}>{delayMinutes}分の遅れを想定しています</Text>
        ) : null}
      </ScrollView>

      <ItineraryItemEditSheet
        visible={showEditSheet}
        target={editTarget}
        payload={planPayload}
        onClose={() => {
          setShowEditSheet(false);
          setEditTarget(null);
        }}
        onApply={handleApplyEdit}
      />

      <TripDayModeDelaySheet
        visible={showDelaySheet}
        payload={planPayload}
        dayIndex={dayIndex}
        onClose={() => setShowDelaySheet(false)}
        onApply={handleApplyDelay}
        onDelaySelected={setDelayMinutes}
      />

      <WeatherReplanPreviewSheet
        visible={showRainSheet}
        payload={planPayload}
        onClose={() => setShowRainSheet(false)}
        onApply={handleApplyWeatherReplan}
      />
    </ScreenBackground>
  );
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
  centered: {
    flex: 1,
    paddingHorizontal: NS.layout.screenPadding,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.three,
    paddingVertical: Spacing.one,
  },
  backButtonText: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  header: {
    gap: Spacing.one,
    marginBottom: Spacing.four,
  },
  eyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
  },
  screenTitle: {
    color: NS.colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tripTitle: {
    color: NS.colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: Spacing.one,
  },
  date: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  destination: {
    color: NS.colors.textSecondary,
    fontSize: 14,
  },
  weatherNote: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.one,
  },
  dayLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: Spacing.one,
  },
  statusBanner: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.lg,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.accent,
    marginBottom: Spacing.four,
    gap: Spacing.one,
  },
  statusBannerText: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '800',
  },
  statusBannerSub: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  section: {
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  delayStatus: {
    color: NS.colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  emptyText: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: Spacing.five,
  },
  memoryButton: {
    marginTop: Spacing.four,
    backgroundColor: NS.colors.coralSoft,
    borderRadius: NS.radius.lg,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderColor: NS.colors.coral,
    alignItems: 'center',
  },
  memoryButtonPressed: {
    opacity: 0.9,
  },
  memoryButtonText: {
    color: NS.colors.coral,
    fontSize: 15,
    fontWeight: '800',
  },
});
