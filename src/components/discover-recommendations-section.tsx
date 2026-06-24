import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PublicPlanCard } from '@/components/public-plan-card';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  buildRecommendationContext,
  searchPublicPlansWithAi,
} from '@/lib/discover-recommendations';
import type {
  AiPlanSearchResult,
  DiscoverRecommendationsResult,
  RecommendedPlanItem,
} from '@/types/discover-recommendations';
import type { PublicPlan } from '@/types/public-plan';
import type { DiscoverFilterState } from '@/types/discover-filters';
import type { CurrentCoordinatesResult } from '@/lib/current-location';

type DiscoverRecommendationsSectionProps = {
  recommendations: DiscoverRecommendationsResult | null;
  isLoading: boolean;
  allPlans: PublicPlan[];
  currentUserId: string | null;
  filters: DiscoverFilterState;
  location: CurrentCoordinatesResult | null;
  popularCreatorIds: Set<string>;
  onFollowChange: (planId: string, next: { isFollowing: boolean; followerCount: number }) => void;
  onRequireLogin: () => void;
};

function RecommendedPlanCard({
  item,
  index,
  currentUserId,
  popularCreatorIds,
  onFollowChange,
  onRequireLogin,
}: {
  item: RecommendedPlanItem;
  index: number;
  currentUserId: string | null;
  popularCreatorIds: Set<string>;
  onFollowChange: (planId: string, next: { isFollowing: boolean; followerCount: number }) => void;
  onRequireLogin: () => void;
}) {
  return (
    <View style={styles.cardWrap}>
      <PublicPlanCard
        plan={item.plan}
        index={index}
        currentUserId={currentUserId}
        showPopularCreatorBadge={popularCreatorIds.has(item.plan.userId)}
        compact
        onPress={() => router.push(`/public-plan/${item.plan.id}`)}
        onFollowChange={onFollowChange}
        onRequireLogin={onRequireLogin}
      />
      <View style={styles.reasonWrap}>
        <Text style={styles.reasonLabel}>おすすめ理由</Text>
        <Text style={styles.reasonText}>{item.reason}</Text>
      </View>
    </View>
  );
}

function AiSearchModal({
  visible,
  onClose,
  allPlans,
  currentUserId,
  filters,
  location,
  popularCreatorIds,
  onFollowChange,
  onRequireLogin,
}: {
  visible: boolean;
  onClose: () => void;
  allPlans: PublicPlan[];
  currentUserId: string | null;
  filters: DiscoverFilterState;
  location: CurrentCoordinatesResult | null;
  popularCreatorIds: Set<string>;
  onFollowChange: (planId: string, next: { isFollowing: boolean; followerCount: number }) => void;
  onRequireLogin: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiPlanSearchResult | null>(null);

  const handleSearch = async () => {
    setIsSearching(true);
    setError(null);
    setResult(null);

    try {
      const context = await buildRecommendationContext(currentUserId, filters, location);
      setResult(await searchPublicPlansWithAi(query, allPlans, context));
    } catch (err) {
      setError(err instanceof Error ? err.message : '検索に失敗しました');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClose = () => {
    setQuery('');
    setError(null);
    setResult(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.modalContainer, { paddingTop: insets.top + Spacing.three }]}>
        <View style={styles.modalHeader}>
          <Pressable onPress={handleClose}>
            <Text style={styles.modalClose}>閉じる</Text>
          </Pressable>
          <Text style={styles.modalTitle}>AIに探してもらう</Text>
          <View style={styles.modalHeaderSpacer} />
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={[
            styles.modalContent,
            { paddingBottom: insets.bottom + Spacing.six },
          ]}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.modalLabel}>今日はどんな気分？</Text>
          <TextInput
            style={styles.modalInput}
            value={query}
            onChangeText={setQuery}
            placeholder="例：雨やけど彼女とゆっくり過ごしたい、予算は1万円以内"
            placeholderTextColor={NS.colors.textMuted}
            multiline
            textAlignVertical="top"
          />

          <PrimaryButton
            label={isSearching ? '探しています...' : 'おすすめを探す'}
            onPress={() => void handleSearch()}
            disabled={isSearching || !query.trim()}
          />

          {isSearching ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="small" color={NS.colors.accent} />
              <Text style={styles.modalLoadingText}>あなたに合うプランを探しています...</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.modalError}>{error}</Text> : null}

          {result ? (
            <View style={styles.modalResults}>
              {result.items.length > 0 ? (
                <>
                  <Text style={styles.modalResultsTitle}>AIのおすすめ</Text>
                  {result.items.map((item, index) => (
                    <RecommendedPlanCard
                      key={item.plan.id}
                      item={item}
                      index={index}
                      currentUserId={currentUserId}
                      popularCreatorIds={popularCreatorIds}
                      onFollowChange={onFollowChange}
                      onRequireLogin={onRequireLogin}
                    />
                  ))}
                </>
              ) : null}

              {result.suggestCreatePlan ? (
                <PremiumCard variant="accent" style={styles.createPlanCard}>
                  <Text style={styles.createPlanTitle}>
                    {result.createPlanMessage ??
                      '条件にぴったりの公開プランがまだ少ないようです。'}
                  </Text>
                  <Text style={styles.createPlanText}>
                    AIがあなたの気分に合わせて、新しいオリジナルプランを提案できます。
                  </Text>
                  <PrimaryButton
                    label="AIでプランを作る"
                    onPress={() => {
                      handleClose();
                      router.push('/');
                    }}
                  />
                </PremiumCard>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function DiscoverRecommendationsSection({
  recommendations,
  isLoading,
  allPlans,
  currentUserId,
  filters,
  location,
  popularCreatorIds,
  onFollowChange,
  onRequireLogin,
}: DiscoverRecommendationsSectionProps) {
  const [aiModalVisible, setAiModalVisible] = useState(false);

  const openAiModal = useCallback(() => {
    setAiModalVisible(true);
  }, []);

  if (isLoading) {
    return (
      <PremiumCard variant="accent" style={styles.sectionCard}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={NS.colors.accent} />
          <Text style={styles.loadingText}>あなたへのおすすめを準備中...</Text>
        </View>
      </PremiumCard>
    );
  }

  if (!recommendations) return null;

  return (
    <>
      <PremiumCard variant="accent" style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionEmoji}>✨</Text>
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionTitle}>あなたへのおすすめ</Text>
              <Text style={styles.sectionSubtitle}>
                旅行メモリー・好み・天気・現在地からパーソナルに厳選
              </Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.aiButton, pressed && styles.aiButtonPressed]}
            onPress={openAiModal}>
            <Text style={styles.aiButtonText}>AIに探してもらう</Text>
          </Pressable>
        </View>

        {recommendations.isSparse || recommendations.totalCount === 0 ? (
          <View style={styles.sparseCard}>
            <Text style={styles.sparseText}>
              まだおすすめできるプランが少ないです。人気プランを保存するとおすすめ精度が上がります。
            </Text>
          </View>
        ) : null}

        {recommendations.totalCount > 0 ? (
          recommendations.categories.map((category) => (
            <View key={category.id} style={styles.categoryBlock}>
              <Text style={styles.categoryTitle}>{category.title}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}>
                {category.items.map((item, index) => (
                  <View key={item.plan.id} style={styles.horizontalCardWrap}>
                    <RecommendedPlanCard
                      item={item}
                      index={index}
                      currentUserId={currentUserId}
                      popularCreatorIds={popularCreatorIds}
                      onFollowChange={onFollowChange}
                      onRequireLogin={onRequireLogin}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          ))
        ) : null}
      </PremiumCard>

      <AiSearchModal
        visible={aiModalVisible}
        onClose={() => setAiModalVisible(false)}
        allPlans={allPlans}
        currentUserId={currentUserId}
        filters={filters}
        location={location}
        popularCreatorIds={popularCreatorIds}
        onFollowChange={onFollowChange}
        onRequireLogin={onRequireLogin}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  sectionHeader: {
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  sectionHeaderText: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  sectionEmoji: {
    fontSize: 28,
  },
  sectionTitleWrap: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  aiButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: NS.radius.pill,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  aiButtonPressed: {
    opacity: 0.9,
  },
  aiButtonText: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
  },
  sparseCard: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  sparseText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  categoryBlock: {
    marginBottom: Spacing.four,
  },
  categoryTitle: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: Spacing.three,
  },
  categoryScroll: {
    gap: Spacing.three,
  },
  horizontalCardWrap: {
    width: 300,
  },
  cardWrap: {
    gap: Spacing.two,
  },
  reasonWrap: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    padding: Spacing.three,
  },
  reasonLabel: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  reasonText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
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
    borderBottomWidth: 1,
    borderBottomColor: NS.colors.border,
  },
  modalClose: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '600',
    minWidth: 56,
  },
  modalTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  modalHeaderSpacer: {
    minWidth: 56,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalLabel: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  modalInput: {
    minHeight: 120,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.four,
    color: NS.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  modalLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  modalLoadingText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
  },
  modalError: {
    color: NS.colors.danger,
    fontSize: 13,
    lineHeight: 20,
  },
  modalResults: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  modalResultsTitle: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  createPlanCard: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  createPlanTitle: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  createPlanText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.two,
  },
});
