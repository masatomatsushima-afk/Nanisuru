import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { ProfileHeader } from '@/components/profile-header';
import { ProfileMemoryGridCard } from '@/components/profile-memory-grid-card';
import { ProfilePlanGridCard } from '@/components/profile-plan-grid-card';
import { ProfileSavedGridCard } from '@/components/profile-saved-grid-card';
import { ProfileSpotGridCard } from '@/components/profile-spot-grid-card';
import { ProfileTabBar } from '@/components/profile-tab-bar';
import { ReportReasonSheet } from '@/components/report-reason-sheet';
import { ScreenBackground } from '@/components/ui/screen-background';
import { ErrorStateCard } from '@/components/ui/state-cards';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getActionErrorMessage } from '@/lib/app-errors';
import { fetchLocalHiddenSpotsByUserId } from '@/lib/local-hidden-spots';
import { fetchUserSavedPortfolioItems } from '@/lib/profile-saves';
import { fetchPublicPlansByUserId } from '@/lib/public-plans';
import { reportUser } from '@/lib/content-reports';
import { blockUser } from '@/lib/user-blocks';
import { fetchProfilePublicMemoriesByUserId } from '@/lib/trip-memories';
import { getUserProfileById } from '@/lib/user-profiles';
import { PLAN_REPORT_REASONS } from '@/types/moderation';
import type { ProfileSavedItem, ProfileTabId } from '@/types/profile-portfolio';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';
import type { PublicPlan } from '@/types/public-plan';
import type { TripMemory } from '@/types/trip-memory';
import type { UserProfile } from '@/types/user-profile';

function ProfileEmptyState({ emoji, message }: { emoji: string; message: string }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

export default function CreatorProfileScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const currentUserId = session?.user.id ?? null;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [memories, setMemories] = useState<TripMemory[]>([]);
  const [spots, setSpots] = useState<LocalHiddenSpot[]>([]);
  const [savedItems, setSavedItems] = useState<ProfileSavedItem[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTabId>('plans');
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showReportSheet, setShowReportSheet] = useState(false);

  const isSelf = useMemo(
    () => Boolean(profile?.isSelf || (currentUserId && currentUserId === id)),
    [profile?.isSelf, currentUserId, id],
  );

  const loadProfile = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const [loadedProfile, loadedPlans, loadedMemories, loadedSpots] = await Promise.all([
        getUserProfileById(id),
        fetchPublicPlansByUserId(id),
        fetchProfilePublicMemoriesByUserId(id),
        fetchLocalHiddenSpotsByUserId(id),
      ]);

      if (!loadedProfile && loadedPlans.length === 0 && loadedMemories.length === 0 && loadedSpots.length === 0) {
        setNotFound(true);
        setProfile(null);
        setPlans([]);
        setMemories([]);
        setSpots([]);
        setSavedItems([]);
        return;
      }

      setProfile(loadedProfile);
      setPlans(loadedPlans);
      setMemories(loadedMemories);
      setSpots(loadedSpots);
      setNotFound(false);

      if (loadedProfile?.isSelf || currentUserId === id) {
        try {
          setSavedItems(await fetchUserSavedPortfolioItems());
        } catch {
          setSavedItems([]);
        }
      } else {
        setSavedItems([]);
      }
    } catch (error) {
      setLoadError(getActionErrorMessage(error, 'プロフィールの読み込みに失敗しました'));
      setNotFound(false);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!isSelf && activeTab === 'saved') {
      setActiveTab('plans');
    }
  }, [activeTab, isSelf]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={NS.colors.accent} />
        <Text style={styles.loadingText}>プロフィールを読み込み中...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.centered, styles.container, { paddingTop: insets.top + Spacing.four }]}>
        <ErrorStateCard message={loadError} onRetry={() => void loadProfile()} />
        <Pressable style={styles.homeButton} onPress={() => router.back()}>
          <Text style={styles.homeButtonText}>戻る</Text>
        </Pressable>
      </View>
    );
  }

  if (notFound) {
    return (
      <View style={[styles.centered, styles.container, { paddingTop: insets.top + Spacing.four }]}>
        <Text style={styles.notFoundIcon}>👤</Text>
        <Text style={styles.errorTitle}>プロフィールが見つかりません</Text>
        <Pressable style={styles.homeButton} onPress={() => router.back()}>
          <Text style={styles.homeButtonText}>戻る</Text>
        </Pressable>
      </View>
    );
  }

  const displayProfile: UserProfile =
    profile ??
    ({
      userId: id!,
      displayName:
        plans[0]?.creatorDisplayName ??
        memories[0]?.title ??
        spots[0]?.creatorDisplayName ??
        'Nanisuruユーザー',
      bio: '',
      styleTags: [],
      isLocalContributor: false,
      localExpertAreas: [],
      followerCount: 0,
      followingCount: 0,
      publicPlanCount: plans.length,
      publicMemoryCount: memories.length,
      localSpotCount: spots.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSelf,
      isFollowing: false,
    } satisfies UserProfile);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'plans':
        return plans.length === 0 ? (
          <ProfileEmptyState emoji="🗺️" message="まだ公開プランはありません" />
        ) : (
          <View style={styles.grid}>
            {plans.map((plan) => (
              <ProfilePlanGridCard
                key={plan.id}
                plan={plan}
                onPress={() => router.push(`/public-plan/${plan.id}`)}
              />
            ))}
          </View>
        );
      case 'memories':
        return memories.length === 0 ? (
          <ProfileEmptyState emoji="📸" message="まだ思い出はありません" />
        ) : (
          <View style={styles.grid}>
            {memories.map((memory) => (
              <ProfileMemoryGridCard
                key={memory.id}
                memory={memory}
                onPress={() => router.push(`/memory/${memory.id}`)}
              />
            ))}
          </View>
        );
      case 'spots':
        return spots.length === 0 ? (
          <ProfileEmptyState emoji="🌿" message="まだ穴場スポットはありません" />
        ) : (
          <View style={styles.grid}>
            {spots.map((spot, index) => (
              <ProfileSpotGridCard
                key={spot.id}
                spot={spot}
                index={index}
                onPress={() => router.push(`/local-spot/${spot.id}`)}
              />
            ))}
          </View>
        );
      case 'saved':
        return savedItems.length === 0 ? (
          <ProfileEmptyState emoji="🔖" message="まだ保存したコンテンツはありません" />
        ) : (
          <View style={styles.grid}>
            {savedItems.map((item) => (
              <ProfileSavedGridCard
                key={`${item.type}-${item.type === 'plan' ? item.plan.id : item.type === 'memory' ? item.memory.id : item.spot.id}`}
                item={item}
                onPress={() => {
                  if (item.type === 'plan') router.push(`/public-plan/${item.plan.id}`);
                  else if (item.type === 'memory') router.push(`/memory/${item.memory.id}`);
                  else router.push(`/local-spot/${item.spot.id}`);
                }}
              />
            ))}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ScreenBackground>
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
          <Text style={styles.backButtonText}>← 戻る</Text>
        </Pressable>

        <ProfileHeader
          profile={{ ...displayProfile, isSelf }}
          isLoggedIn={Boolean(session)}
          onRequireLogin={() => router.push('/login')}
          onFollowChange={(next) =>
            setProfile((prev) =>
              prev
                ? {
                    ...prev,
                    isFollowing: next.isFollowing,
                    followerCount: next.followerCount,
                  }
                : prev,
            )
          }
        />

        <ProfileTabBar activeTab={activeTab} isSelf={isSelf} onChange={setActiveTab} />

        {renderTabContent()}

        {!isSelf ? (
          <View style={styles.safetySection}>
            <Text style={styles.safetyTitle}>安全・プライバシー</Text>
            <Pressable
              style={styles.safetyButton}
              onPress={() => {
                if (!session) {
                  router.push('/login');
                  return;
                }
                setShowReportSheet(true);
              }}>
              <Text style={styles.safetyButtonText}>このユーザーを通報</Text>
            </Pressable>
            <Pressable
              style={styles.safetyButton}
              onPress={() => {
                if (!session) {
                  router.push('/login');
                  return;
                }
                Alert.alert(
                  'ユーザーをブロック',
                  'このユーザーをブロックしますか？今後、このユーザーの公開プランやコメントは表示されなくなります。',
                  [
                    { text: 'キャンセル', style: 'cancel' },
                    {
                      text: 'ブロックする',
                      style: 'destructive',
                      onPress: () => {
                        void blockUser(displayProfile.userId)
                          .then(() => {
                            Alert.alert('ブロックしました', 'このユーザーのコンテンツは表示されなくなりました。');
                            router.back();
                          })
                          .catch((error) => {
                            Alert.alert(
                              'エラー',
                              error instanceof Error ? error.message : 'ブロックに失敗しました',
                            );
                          });
                      },
                    },
                  ],
                );
              }}>
              <Text style={styles.safetyButtonText}>このユーザーをブロック</Text>
            </Pressable>
          </View>
        ) : null}

        <ReportReasonSheet
          visible={showReportSheet}
          title="ユーザーを通報"
          subtitle="問題の内容に最も近い理由を選んでください。"
          reasons={PLAN_REPORT_REASONS}
          onClose={() => setShowReportSheet(false)}
          onSubmit={async (reason, details) => {
            await reportUser(displayProfile.userId, reason, details);
            Alert.alert(
              'ご報告ありがとうございます',
              '内容を確認いたします。安全なコミュニティ維持にご協力いただき、ありがとうございます。',
            );
          }}
        />
      </ScrollView>
    </ScreenBackground>
  );
}

const accent = NS.colors.accent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    maxWidth: 520,
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
    marginBottom: Spacing.two,
  },
  backButtonText: {
    color: accent,
    fontSize: 16,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  emptyBox: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.xl,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyEmoji: {
    fontSize: 32,
  },
  emptyText: {
    color: NS.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  notFoundIcon: {
    fontSize: 40,
    marginBottom: Spacing.three,
  },
  errorTitle: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '800',
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
  safetySection: {
    marginTop: Spacing.five,
    gap: Spacing.two,
    paddingTop: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
  },
  safetyTitle: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  safetyButton: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  safetyButtonText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
