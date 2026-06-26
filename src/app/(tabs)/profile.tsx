import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type MutableRefObject } from 'react';
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

import { BetaTestEntryButton } from '@/components/beta-test-entry-button';
import { NotificationEntryButton } from '@/components/notification-entry-button';
import { ProfileEmptyState } from '@/components/profile-empty-state';
import { ProfileHeader } from '@/components/profile-header';
import { ProfileMemoryGridCard } from '@/components/profile-memory-grid-card';
import { ProfileOwnerActions } from '@/components/profile-owner-actions';
import { ProfilePlanGridCard } from '@/components/profile-plan-grid-card';
import { ProfileSavedGridCard } from '@/components/profile-saved-grid-card';
import { ProfileSpotGridCard } from '@/components/profile-spot-grid-card';
import { ProfileTabBar } from '@/components/profile-tab-bar';
import { PublicProfileEditor } from '@/components/public-profile-editor';
import { RatingTendencySection } from '@/components/rating-tendency-section';
import { TravelPreferencesEditor } from '@/components/travel-preferences-editor';
import { UserPreferencesSection } from '@/components/user-preferences-section';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { ScreenBackground } from '@/components/ui/screen-background';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getAuthProviderLabel, getUserDisplayName } from '@/lib/auth';
import { fetchLocalHiddenSpotsByUserId } from '@/lib/local-hidden-spots';
import { fetchUserSavedPortfolioItems } from '@/lib/profile-saves';
import { fetchPublicPlansByUserId } from '@/lib/public-plans';
import { fetchProfilePublicMemoriesByUserId } from '@/lib/trip-memories';
import { getUserPreferences } from '@/lib/user-memory';
import { ensureUserProfile } from '@/lib/user-profiles';
import type { ProfileSavedItem, ProfileTabId } from '@/types/profile-portfolio';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';
import type { PublicPlan } from '@/types/public-plan';
import type { TripMemory } from '@/types/trip-memory';
import type { UserProfile } from '@/types/user-profile';
import type { UserPreferences } from '@/types/user-memory';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, isConfigured, signOut } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const profileEditorY = useRef(0);
  const preferencesEditorY = useRef(0);
  const privacySectionY = useRef(0);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [memories, setMemories] = useState<TripMemory[]>([]);
  const [spots, setSpots] = useState<LocalHiddenSpot[]>([]);
  const [savedItems, setSavedItems] = useState<ProfileSavedItem[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTabId>('plans');
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

  const scrollTo = (yRef: MutableRefObject<number>) => {
    scrollRef.current?.scrollTo({
      y: Math.max(yRef.current - Spacing.three, 0),
      animated: true,
    });
  };

  const loadPreferences = useCallback(async () => {
    setUserPreferences(await getUserPreferences());
  }, []);

  const loadPortfolio = useCallback(async () => {
    if (!user || !isConfigured) {
      setProfile(null);
      setPlans([]);
      setMemories([]);
      setSpots([]);
      setSavedItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [loadedProfile, loadedPlans, loadedMemories, loadedSpots, loadedSaved] =
        await Promise.all([
          ensureUserProfile(),
          fetchPublicPlansByUserId(user.id),
          fetchProfilePublicMemoriesByUserId(user.id),
          fetchLocalHiddenSpotsByUserId(user.id),
          fetchUserSavedPortfolioItems().catch(() => [] as ProfileSavedItem[]),
        ]);

      setProfile({ ...loadedProfile, isSelf: true });
      setPlans(loadedPlans);
      setMemories(loadedMemories);
      setSpots(loadedSpots);
      setSavedItems(loadedSaved);
    } catch {
      setProfile(null);
      setPlans([]);
      setMemories([]);
      setSpots([]);
      setSavedItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, user]);

  useFocusEffect(
    useCallback(() => {
      void loadPreferences();
      void loadPortfolio();
    }, [loadPortfolio, loadPreferences]),
  );

  const handleSignOut = async () => {
    Alert.alert('ログアウト', 'ログアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: async () => {
          setIsSigningOut(true);
          try {
            await signOut();
            router.replace('/login');
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'ログアウトに失敗しました';
            Alert.alert('エラー', message);
          } finally {
            setIsSigningOut(false);
          }
        },
      },
    ]);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'plans':
        return plans.length === 0 ? (
          <ProfileEmptyState
            emoji="🗺️"
            title="まだ公開プランがありません"
            description="プランを作って公開すると、ここに表示されます。"
            buttonLabel="プランを作る"
            onAction={() => router.push('/')}
          />
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
          <ProfileEmptyState
            emoji="📸"
            title="まだ思い出がありません"
            description="旅の写真やメモをアルバム形式で残してみましょう。"
            buttonLabel="思い出を追加"
            onAction={() => router.push('/memories')}
          />
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
          <ProfileEmptyState
            emoji="🌿"
            title="まだ穴場スポットがありません"
            description="地元のおすすめスポットをシェアしてみませんか？"
            buttonLabel="穴場を投稿"
            onAction={() => router.push('/local-spot/submit')}
          />
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
          <ProfileEmptyState
            emoji="🔖"
            title="まだ保存したコンテンツがありません"
            description="気になるプランや思い出を保存すると、ここに表示されます。"
            buttonLabel="発見タブで探す"
            onAction={() => router.push('/(tabs)/explore')}
          />
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

  if (!user) {
    return (
      <ScreenBackground>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + Spacing.three,
              paddingBottom: insets.bottom + BottomTabInset + Spacing.five,
            },
          ]}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.screenTitle}>マイページ</Text>

          <PremiumCard style={styles.guestCard}>
            <Text style={styles.guestEmoji}>👤</Text>
            <Text style={styles.guestTitle}>ログインしていません</Text>
            <Text style={styles.guestText}>
              ログインすると、公開プランや思い出、保存したコンテンツを確認できます。
            </Text>
            <PrimaryButton label="ログイン" onPress={() => router.push('/login')} variant="warm" />
            <Pressable style={styles.signUpLink} onPress={() => router.push('/sign-up')}>
              <Text style={styles.signUpLinkText}>新規登録はこちら</Text>
            </Pressable>
          </PremiumCard>

          <BetaTestEntryButton />

          {userPreferences ? <UserPreferencesSection preferences={userPreferences} /> : null}

          <RatingTendencySection isLoggedIn={false} isConfigured={isConfigured} />

          <PublicProfileEditor
            isLoggedIn={false}
            isConfigured={isConfigured}
            onRequireLogin={() => router.push('/login')}
          />

          <TravelPreferencesEditor
            isLoggedIn={false}
            isConfigured={isConfigured}
            onRequireLogin={() => router.push('/login')}
          />
        </ScrollView>
      </ScreenBackground>
    );
  }

  const displayProfile: UserProfile =
    profile ??
    ({
      userId: user.id,
      displayName: getUserDisplayName(user),
      bio: '',
      styleTags: [],
      isLocalContributor: false,
      localExpertAreas: [],
      followerCount: 0,
      followingCount: 0,
      publicPlanCount: plans.length,
      publicMemoryCount: memories.length,
      localSpotCount: spots.length,
      createdAt: user.created_at ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSelf: true,
    } satisfies UserProfile);

  const providerLabel = getAuthProviderLabel(user);

  return (
    <ScreenBackground>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.two,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.five,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.screenTitle}>マイページ</Text>
            <Text style={styles.screenSubtitle}>あなたの旅の記録</Text>
          </View>
        </View>

        <NotificationEntryButton isConfigured={isConfigured} />

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={NS.colors.accent} />
            <Text style={styles.loadingText}>読み込み中...</Text>
          </View>
        ) : (
          <>
            <ProfileHeader
              profile={displayProfile}
              isLoggedIn
              onRequireLogin={() => router.push('/login')}
              onFollowChange={() => {}}
              onEditPress={() => scrollTo(profileEditorY)}
            />

            <ProfileOwnerActions
              onEditProfile={() => scrollTo(profileEditorY)}
              onEditPreferences={() => scrollTo(preferencesEditorY)}
              onPrivacySettings={() => scrollTo(privacySectionY)}
            />

            <ProfileTabBar activeTab={activeTab} isSelf onChange={setActiveTab} />

            {renderTabContent()}
          </>
        )}

        <View
          onLayout={(event) => {
            privacySectionY.current = event.nativeEvent.layout.y;
          }}
          style={styles.settingsSection}>
          <PremiumCard style={styles.previewCard}>
            <Text style={styles.previewEmoji}>✨</Text>
            <Text style={styles.previewTitle}>公開プロフィール</Text>
            <Text style={styles.previewText}>
              他のユーザーから見えるプロフィールを確認できます。プランや思い出の公開設定も各投稿から変更できます。
            </Text>
            <PrimaryButton
              label="公開プロフィールを見る"
              onPress={() => router.push(`/creator/${user.id}`)}
              variant="warm"
            />
          </PremiumCard>
        </View>

        <View
          onLayout={(event) => {
            profileEditorY.current = event.nativeEvent.layout.y;
          }}>
          <PublicProfileEditor
            isLoggedIn
            isConfigured={isConfigured}
            onRequireLogin={() => router.push('/login')}
          />
        </View>

        {userPreferences ? <UserPreferencesSection preferences={userPreferences} /> : null}

        <RatingTendencySection isLoggedIn isConfigured={isConfigured} />

        <View
          onLayout={(event) => {
            preferencesEditorY.current = event.nativeEvent.layout.y;
          }}>
          <TravelPreferencesEditor
            isLoggedIn
            isConfigured={isConfigured}
            onRequireLogin={() => router.push('/login')}
          />
        </View>

        <BetaTestEntryButton />

        <PremiumCard style={styles.accountCard}>
          <Text style={styles.accountTitle}>アカウント</Text>
          <Text style={styles.accountMeta}>
            {user.email ?? 'メール非公開'} · {providerLabel}
          </Text>
          <PrimaryButton
            label={isSigningOut ? 'ログアウト中...' : 'ログアウト'}
            onPress={handleSignOut}
            disabled={isSigningOut}
            variant="secondary"
          />
        </PremiumCard>

        {!isConfigured ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>Supabaseの設定を確認してください</Text>
          </View>
        ) : null}
      </ScrollView>
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
    gap: Spacing.three,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    color: NS.colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  settingsSection: {
    marginTop: Spacing.two,
  },
  previewCard: {
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  previewEmoji: {
    fontSize: 28,
  },
  previewTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  previewText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  accountCard: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  accountTitle: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  accountMeta: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  guestCard: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  guestEmoji: {
    fontSize: 40,
  },
  guestTitle: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  guestText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  signUpLink: {
    paddingVertical: Spacing.one,
  },
  signUpLinkText: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  notice: {
    backgroundColor: NS.colors.dangerSoft,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
  },
  noticeText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
});
