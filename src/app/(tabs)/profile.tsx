import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
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
import { DevTestDataResetButton } from '@/components/dev-test-data-reset-button';
import { FeedbackEntryButton } from '@/components/feedback-entry-button';
import { NotificationEntryButton } from '@/components/notification-entry-button';
import { PreferenceSettingsCard } from '@/components/preference-settings-card';
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
import { MVP_VERSION_LABEL } from '@/constants/mvp-qa';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getAuthProviderLabel, getUserDisplayName, getUserInitial } from '@/lib/auth';
import { confirmSignOut, showSignedOutMessage } from '@/lib/require-auth';
import { fetchLocalHiddenSpotsByUserId } from '@/lib/local-hidden-spots';
import { fetchUserSavedPortfolioItems } from '@/lib/profile-saves';
import { fetchPublicPlansByUserId } from '@/lib/public-plans';
import { fetchProfilePublicMemoriesByUserId } from '@/lib/trip-memories';
import { ensureUserProfile } from '@/lib/user-profiles';
import { loopTestLogOnce } from '@/lib/loop-test-config';
import { safeKey, safeText } from '@/lib/safe-text';
import { EMPTY_USER_PREFERENCES } from '@/lib/user-memory';
import type { ProfileSavedItem, ProfileTabId } from '@/types/profile-portfolio';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';
import type { PublicPlan } from '@/types/public-plan';
import type { TripMemory } from '@/types/trip-memory';
import type { UserProfile } from '@/types/user-profile';
import {
  EMPTY_TRAVEL_USER_PREFERENCES,
  type TravelUserPreferences,
} from '@/types/travel-user-preferences';

function sameJson<T>(left: T, right: T): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function savedItemKey(item: ProfileSavedItem, index: number): string {
  if (item.type === 'plan') {
    return `saved-plan-${safeKey(item.plan.id, `item-${index}`)}-${index}`;
  }
  if (item.type === 'memory') {
    return `saved-memory-${safeKey(item.memory.id, `item-${index}`)}-${index}`;
  }
  return `saved-spot-${safeKey(item.spot.id, `item-${index}`)}-${index}`;
}

export default function ProfileScreen() {
  loopTestLogOnce('restore:Profile', 'restoring Profile / マイページ');

  const insets = useSafeAreaInsets();
  const { user, isConfigured, isLoggedIn, signOut } = useAuth();
  const userId = user?.id ?? null;
  const loadInFlightRef = useRef(false);
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
  const userPreferences = EMPTY_USER_PREFERENCES;
  const [travelUserPreferences] = useState<TravelUserPreferences>(EMPTY_TRAVEL_USER_PREFERENCES);

  const scrollTo = (yRef: MutableRefObject<number>) => {
    scrollRef.current?.scrollTo({
      y: Math.max(yRef.current - Spacing.three, 0),
      animated: true,
    });
  };

  const loadPortfolio = useCallback(async () => {
    if (!userId || !isConfigured) {
      setProfile((prev) => (prev === null ? prev : null));
      setPlans((prev) => (prev.length === 0 ? prev : []));
      setMemories((prev) => (prev.length === 0 ? prev : []));
      setSpots((prev) => (prev.length === 0 ? prev : []));
      setSavedItems((prev) => (prev.length === 0 ? prev : []));
      setIsLoading((prev) => (prev ? false : prev));
      return;
    }

    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    setIsLoading((prev) => (prev ? prev : true));

    try {
      const [loadedProfile, loadedPlans, loadedMemories, loadedSpots, loadedSaved] =
        await Promise.all([
          ensureUserProfile(),
          fetchPublicPlansByUserId(userId),
          fetchProfilePublicMemoriesByUserId(userId),
          fetchLocalHiddenSpotsByUserId(userId),
          fetchUserSavedPortfolioItems().catch((err) => {
            console.warn('[Profile] saved items load failed', err);
            return [] as ProfileSavedItem[];
          }),
        ]);

      const nextProfile: UserProfile = { ...loadedProfile, isSelf: true };
      setProfile((prev) => (sameJson(prev, nextProfile) ? prev : nextProfile));
      setPlans((prev) => (sameJson(prev, loadedPlans) ? prev : loadedPlans));
      setMemories((prev) => (sameJson(prev, loadedMemories) ? prev : loadedMemories));
      setSpots((prev) => (sameJson(prev, loadedSpots) ? prev : loadedSpots));
      setSavedItems((prev) => (sameJson(prev, loadedSaved) ? prev : loadedSaved));
    } catch (err) {
      console.warn('[Profile] portfolio load failed', err);
      setProfile((prev) => (prev === null ? prev : null));
      setPlans((prev) => (prev.length === 0 ? prev : []));
      setMemories((prev) => (prev.length === 0 ? prev : []));
      setSpots((prev) => (prev.length === 0 ? prev : []));
      setSavedItems((prev) => (prev.length === 0 ? prev : []));
    } finally {
      loadInFlightRef.current = false;
      setIsLoading((prev) => (prev ? false : prev));
    }
  }, [isConfigured, userId]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  const handleSignOut = () => {
    confirmSignOut(async () => {
      setIsSigningOut(true);
      try {
        await signOut();
        showSignedOutMessage();
      } catch {
        Alert.alert('エラー', '通信に失敗しました');
      } finally {
        setIsSigningOut(false);
      }
    });
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
            onAction={() => router.push('/(tabs)')}
          />
        ) : (
          <View style={styles.grid}>
            {plans.map((plan, index) => (
              <ProfilePlanGridCard
                key={`profile-plan-${safeKey(plan.id, `plan-${index}`)}-${index}`}
                plan={plan}
                onPress={() => router.push(`/public-plan/${safeText(plan.id)}`)}
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
            {memories.map((memory, index) => (
              <ProfileMemoryGridCard
                key={`profile-memory-${safeKey(memory.id, `memory-${index}`)}-${index}`}
                memory={memory}
                onPress={() => router.push(`/memory/${safeText(memory.id)}`)}
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
                key={`profile-spot-${safeKey(spot.id, `spot-${index}`)}-${index}`}
                spot={spot}
                index={index}
                onPress={() => router.push(`/local-spot/${safeText(spot.id)}`)}
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
            {savedItems.map((item, index) => (
              <ProfileSavedGridCard
                key={savedItemKey(item, index)}
                item={item}
                onPress={() => {
                  if (item.type === 'plan') {
                    router.push(`/public-plan/${safeText(item.plan.id)}`);
                  } else if (item.type === 'memory') {
                    router.push(`/memory/${safeText(item.memory.id)}`);
                  } else {
                    router.push(`/local-spot/${safeText(item.spot.id)}`);
                  }
                }}
              />
            ))}
          </View>
        );
      default:
        return null;
    }
  };

  if (!isLoggedIn || !user) {
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
              ログインすると、旅行プランや思い出を保存できます
            </Text>
            <PrimaryButton
              label="ログインする"
              onPress={() => router.push('/login')}
              variant="warm"
            />
            <Pressable style={styles.signUpLink} onPress={() => router.push('/sign-up')}>
              <Text style={styles.signUpLinkText}>新規登録</Text>
            </Pressable>
          </PremiumCard>

          <BetaTestEntryButton />

          <FeedbackEntryButton />

          {userPreferences ? <UserPreferencesSection preferences={userPreferences} /> : null}

          <PreferenceSettingsCard preferences={travelUserPreferences} />

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

          <Text style={styles.versionLabel}>{MVP_VERSION_LABEL}</Text>
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
          <View style={styles.loggedInHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{getUserInitial(user)}</Text>
            </View>
            <View style={styles.loggedInMeta}>
              <Text style={styles.screenTitle}>{displayProfile.displayName}</Text>
              <Text style={styles.screenSubtitle}>{user.email ?? 'メール非公開'}</Text>
            </View>
          </View>
        </View>

        <PremiumCard style={styles.quickActionsCard}>
          <PrimaryButton
            label="プロフィール編集"
            onPress={() => router.push('/profile-edit')}
            variant="secondary"
          />
          <PrimaryButton
            label="好み設定"
            onPress={() => router.push('/preference-onboarding')}
            variant="secondary"
          />
          <PrimaryButton
            label={isSigningOut ? 'ログアウト中...' : 'ログアウト'}
            onPress={handleSignOut}
            disabled={isSigningOut}
            variant="secondary"
          />
        </PremiumCard>

        <NotificationEntryButton isConfigured={isConfigured} />

        <Pressable style={styles.myTripsLink} onPress={() => router.push('/my-trips')}>
          <Text style={styles.myTripsEmoji}>🧳</Text>
          <View style={styles.myTripsTextWrap}>
            <Text style={styles.myTripsTitle}>マイトリップ</Text>
            <Text style={styles.myTripsSubtitle}>保存したプランと旅行秘書フォルダ</Text>
          </View>
          <Text style={styles.myTripsChevron}>›</Text>
        </Pressable>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={NS.colors.accent} />
            <Text style={styles.loadingText}>読み込み中…</Text>
          </View>
        ) : (
          <>
            <ProfileHeader
              profile={displayProfile}
              isLoggedIn
              savedCount={savedItems.length}
              onRequireLogin={() => router.push('/login')}
              onFollowChange={() => {}}
              onEditPress={() => scrollTo(profileEditorY)}
            />

            <ProfileOwnerActions
              onEditProfile={() => router.push('/profile-edit')}
              onEditPreferences={() => router.push('/preference-onboarding')}
              onPrivacySettings={() => scrollTo(privacySectionY)}
            />

            <PreferenceSettingsCard
              preferences={travelUserPreferences}
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
              onPress={() => router.push(`/creator/${safeText(user.id)}`)}
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

        <FeedbackEntryButton />

        <DevTestDataResetButton />

        <PremiumCard style={styles.accountCard}>
          <Text style={styles.accountTitle}>アカウント</Text>
          <Text style={styles.accountMeta}>
            {user.email ?? 'メール非公開'} · {providerLabel}
          </Text>
        </PremiumCard>

        {!isConfigured ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>データの同期に接続できません。しばらくしてからお試しください。</Text>
          </View>
        ) : null}

        <Text style={styles.versionLabel}>{MVP_VERSION_LABEL}</Text>
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
  loggedInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: NS.colors.accent,
    fontSize: 22,
    fontWeight: '900',
  },
  loggedInMeta: {
    flex: 1,
    gap: 2,
  },
  quickActionsCard: {
    padding: Spacing.three,
    gap: Spacing.two,
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
  myTripsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  myTripsEmoji: {
    fontSize: 22,
  },
  myTripsTextWrap: {
    flex: 1,
    gap: 2,
  },
  myTripsTitle: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  myTripsSubtitle: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  myTripsChevron: {
    color: NS.colors.accent,
    fontSize: 22,
    fontWeight: '700',
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
  versionLabel: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
});
