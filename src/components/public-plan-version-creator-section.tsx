import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { fetchPublicPlanRequestSummary } from '@/lib/public-plan-requests';
import { createVersionDraftFromRequest } from '@/lib/public-plan-versions';
import {
  getRequestTypeLabel,
  PUBLIC_PLAN_REQUEST_TYPES,
  type PublicPlanRequestSummary,
  type PublicPlanRequestType,
} from '@/types/public-plan-feedback';

type PublicPlanVersionCreatorSectionProps = {
  publicPlanId: string;
  onDraftCreated: (draftPlanId: string) => void;
};

export function PublicPlanVersionCreatorSection({
  publicPlanId,
  onDraftCreated,
}: PublicPlanVersionCreatorSectionProps) {
  const [summary, setSummary] = useState<PublicPlanRequestSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [creatingType, setCreatingType] = useState<PublicPlanRequestType | null>(null);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      setSummary(await fetchPublicPlanRequestSummary(publicPlanId));
    } catch (error) {
      Alert.alert(
        'エラー',
        error instanceof Error ? error.message : 'リクエストの読み込みに失敗しました',
      );
    } finally {
      setIsLoading(false);
    }
  }, [publicPlanId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const handleCreate = async (requestType: PublicPlanRequestType) => {
    setCreatingType(requestType);
    try {
      const { draftPlanId } = await createVersionDraftFromRequest(publicPlanId, requestType);
      onDraftCreated(draftPlanId);
    } catch (error) {
      Alert.alert(
        'エラー',
        error instanceof Error ? error.message : '別バージョンの作成に失敗しました',
      );
    } finally {
      setCreatingType(null);
    }
  };

  return (
    <PremiumCard variant="accent" style={styles.card}>
      <Text style={styles.title}>✨ リクエストから別バージョンを作成</Text>
      <Text style={styles.lead}>
        届いた改善リクエストをもとに、AIがオリジナルプランの別バージョンを生成します。
      </Text>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={NS.colors.accent} />
          <Text style={styles.loadingText}>リクエストを読み込み中...</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {PUBLIC_PLAN_REQUEST_TYPES.map((item) => {
            const count = summary?.counts[item.id] ?? 0;
            const isCreating = creatingType === item.id;
            return (
              <View key={item.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowCount}>{count}件のリクエスト</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.createButton,
                    isCreating && styles.createButtonDisabled,
                    pressed && !isCreating && styles.createButtonPressed,
                  ]}
                  onPress={() => void handleCreate(item.id)}
                  disabled={Boolean(creatingType)}>
                  <Text style={styles.createButtonText}>
                    {isCreating ? '生成中...' : 'AIで作成'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {creatingType ? (
        <Text style={styles.generatingHint}>
          「{getRequestTypeLabel(creatingType)}」に合わせてプランを生成しています...
        </Text>
      ) : null}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.two,
  },
  lead: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.four,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowLabel: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  rowCount: {
    color: NS.colors.textMuted,
    fontSize: 12,
  },
  createButton: {
    backgroundColor: NS.colors.accent,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  createButtonPressed: {
    opacity: 0.9,
  },
  createButtonDisabled: {
    opacity: 0.55,
  },
  createButtonText: {
    color: NS.colors.bg,
    fontSize: 12,
    fontWeight: '800',
  },
  generatingHint: {
    color: NS.colors.accent,
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.three,
    textAlign: 'center',
  },
});
