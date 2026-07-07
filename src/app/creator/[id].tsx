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

import { ProfileEmptyState } from '@/components/profile-empty-state';
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
import { reportUser } from '@/lib/content-reports';
import { fetchLocalHiddenSpotsByUserId } from '@/lib/local-hidden-spots';
import { fetchUserSavedPortfolioItems } from '@/lib/profile-saves';
import { fetchPublicPlansByUserId } from '@/lib/public-plans';
import { fetchProfilePublicMemoriesByUserId } from '@/lib/trip-memories';
import { blockUser } from '@/lib/user-blocks';
import { getUserProfileById } from '@/lib/user-profiles';
import { PLAN_REPORT_REASONS } from '@/types/moderation';
import type { ProfileSavedItem, ProfileTabId } from '@/types/profile-portfolio';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';
import type { PublicPlan } from '@/types/public-plan';
import type { TripMemory } from '@/types/trip-memory';
import type { UserProfile } from '@/types/user-profile';

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

      if (
        !loadedProfile &&
        loadedPlans.length === 0 &&
        loadedMemories.length === 0 &&
        loadedSpots.length === 0
      ) {
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
      <ScreenBackground>
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={NS.colors.accent} />
          <Text style={styles.loadingText}>プロフィールを読み込み中...</Text>
        </View>
      </ScreenBackground>
    );
  }

  if (loadError) {
    return (
      <ScreenBackground>
        <View style={[styles.centered, { paddingTop: insets.top + Spacing.four }]}>
          <ErrorStateCard message={loadError} onRetry={() => void loadProfile()} />
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>戻る</Text>
          </Pressable>
        </View>
      </ScreenBackground>
    );
  }

  if (notFound) {
    return (
      <ScreenBackground>
        <View style={[styles.centered, { paddingTop: insets.top + Spacing.four }]}>
          <ProfileEmptyState emoji="👤" title="プロフィールが見つかりません" />
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>戻る</Text>
          </Pressable>
        </View>
      </ScreenBackground>
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
          <ProfileEmptyState emoji="🗺️" title="まだ公開プランはありません" />
        ) : (
          <View style={styles.grid}>
            {plans.map((plan, index) => (
              <ProfilePlanGridCard
                key={`creator-plan-${plan.id}-${index}`}
                plan={plan}
                onPress={() => router.push(`/public-plan/${plan.id}`)}
              />
            ))}
          </View>
        );
      case 'memories':
        return memories.length === 0 ? (
          <ProfileEmptyState emoji="📸" title="まだ思い出はありません" />
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
          <ProfileEmptyState emoji="🌿" title="まだ穴場スポットはありません" />
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
          <ProfileEmptyState emoji="🔖" title="まだ保存したコンテンツはありません" />
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
            paddingTop: insets.top + Spacing.two,
            paddingBottom: insets.bottom + Spacing.five,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← 戻る</Text>
        </Pressable>

        <ProfileHeader
          profile={{ ...displayProfile, isSelf }}
          isLoggedIn={Boolean(session)}
          savedCount={isSelf ? savedItems.length : 0}
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
                            Alert.alert(
                              'ブロックしました',
                              'このユーザーのコンテンツは表示されなくなりました。',
                            );
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  content: {
    paddingHorizontal: NS.layout.screenPadding,
    maxWidth: NS.layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    marginTop: Spacing.three,
    fontSize: 14,
  },
  backLink: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  backLinkText: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  backBtn: {
    marginTop: Spacing.four,
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  backBtnText: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  safetySection: {
    marginTop: Spacing.four,
    gap: Spacing.two,
    paddingTop: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
  },
  safetyTitle: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  safetyButton: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.four,
  },
  safetyButtonText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
