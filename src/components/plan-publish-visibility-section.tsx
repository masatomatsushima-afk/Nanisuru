import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { PublishPlanSheet } from '@/components/publish-plan-sheet';
import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  getPublishedPlanForTrip,
  publishPublicPlan,
  stopPublicPlan,
} from '@/lib/public-plans';
import { getTripById } from '@/lib/saved-trips';
import type { SavedTrip } from '@/types/trip';
import {
  PLAN_PUBLISH_VISIBILITY_LABELS,
  type PublicPlan,
  type PublicPlanVisibility,
} from '@/types/public-plan';

const VISIBILITY_OPTIONS: PublicPlanVisibility[] = ['private', 'unlisted', 'public'];

type PlanPublishVisibilitySectionProps = {
  savedTripId: string;
  isConfigured: boolean;
};

export function PlanPublishVisibilitySection({
  savedTripId,
  isConfigured,
}: PlanPublishVisibilitySectionProps) {
  const [trip, setTrip] = useState<SavedTrip | null>(null);
  const [publishedPlan, setPublishedPlan] = useState<PublicPlan | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isConfigured || !savedTripId) return;

    void (async () => {
      try {
        const [loadedTrip, published] = await Promise.all([
          getTripById(savedTripId),
          getPublishedPlanForTrip(savedTripId),
        ]);
        setTrip(loadedTrip);
        setPublishedPlan(published);
      } catch {
        setTrip(null);
        setPublishedPlan(null);
      }
    })();
  }, [isConfigured, savedTripId]);

  if (!isConfigured) {
    return (
      <View style={styles.notice}>
        <Text style={styles.noticeText}>公開設定には Supabase の設定が必要です</Text>
      </View>
    );
  }

  if (!trip) return null;

  const currentVisibility: PublicPlanVisibility = publishedPlan?.visibility ?? 'private';

  const refreshPublished = async () => {
    setPublishedPlan(await getPublishedPlanForTrip(savedTripId));
  };

  const applyVisibility = async (visibility: PublicPlanVisibility) => {
    setBusy(true);
    try {
      if (visibility === 'private') {
        if (publishedPlan) {
          await stopPublicPlan(publishedPlan.id);
        }
      } else if (publishedPlan) {
        await publishPublicPlan({
          sourceTripId: trip.id,
          title: publishedPlan.title,
          description: publishedPlan.description,
          category: publishedPlan.category,
          tags: publishedPlan.tags,
          visibility,
          payload: trip.payload,
        });
      } else {
        setShowSheet(true);
        return;
      }

      console.log('[Publish] visibility changed', visibility);
      await refreshPublished();
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : '公開設定の更新に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleVisibilityPress = (visibility: PublicPlanVisibility) => {
    if (visibility === currentVisibility) return;

    if (visibility === 'public') {
      Alert.alert(
        'このプランを公開しますか？',
        '公開すると、発見やプロフィールに表示されます',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '公開する',
            onPress: () => {
              if (publishedPlan) {
                void applyVisibility('public');
              } else {
                setShowSheet(true);
              }
            },
          },
        ],
      );
      return;
    }

    void applyVisibility(visibility);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>公開設定</Text>
      <Text style={styles.lead}>発見タブやプロフィールでの表示を管理できます</Text>

      <View style={styles.chipRow}>
        {VISIBILITY_OPTIONS.map((option) => (
          <Pressable
            key={option}
            style={[styles.chip, currentVisibility === option && styles.chipActive]}
            disabled={busy}
            onPress={() => handleVisibilityPress(option)}>
            <Text style={[styles.chipText, currentVisibility === option && styles.chipTextActive]}>
              {PLAN_PUBLISH_VISIBILITY_LABELS[option]}
            </Text>
          </Pressable>
        ))}
      </View>

      <PrimaryButton
        label="公開内容を編集"
        variant="secondary"
        onPress={() => setShowSheet(true)}
        disabled={busy}
      />

      <PublishPlanSheet
        visible={showSheet}
        trip={trip}
        onClose={() => setShowSheet(false)}
        onPublished={() => {
          void refreshPublished();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  title: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  lead: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: NS.radius.pill,
    backgroundColor: NS.colors.bgInput,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  chipActive: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
  chipTextActive: {
    color: NS.colors.accent,
  },
  notice: {
    padding: Spacing.three,
    backgroundColor: NS.colors.yellowSoft,
    borderRadius: NS.radius.lg,
  },
  noticeText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
  },
});
