import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FollowButton } from '@/components/follow-button';
import { PublicPlanCard } from '@/components/public-plan-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { fetchPublicPlansByUserId } from '@/lib/public-plans';
import { getUserProfileById } from '@/lib/user-profiles';
import type { PublicPlan } from '@/types/public-plan';
import { getProfileInitial, type UserProfile } from '@/types/user-profile';

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [loadedProfile, loadedPlans] = await Promise.all([
        getUserProfileById(id),
        fetchPublicPlansByUserId(id),
      ]);

      if (!loadedProfile && loadedPlans.length === 0) {
        setNotFound(true);
        setProfile(null);
        setPlans([]);
        return;
      }

      setProfile(loadedProfile);
      setPlans(loadedPlans);
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={NS.colors.accent} />
        <Text style={styles.loadingText}>プロフィールを読み込み中...</Text>
      </View>
    );
  }

  if (notFound || !profile) {
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

  const isSelf = currentUserId === profile.userId;

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
        <Text style={styles.backButtonText}>← 戻る</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getProfileInitial(profile.displayName)}</Text>
        </View>
        <Text style={styles.displayName}>{profile.displayName}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        <View style={styles.statsRow}>
          <StatBlock label="公開プラン" value={profile.publicPlanCount ?? plans.length} />
          <StatBlock label="フォロワー" value={profile.followerCount} />
          <StatBlock label="フォロー中" value={profile.followingCount} />
        </View>

        {!isSelf ? (
          <View style={styles.followWrap}>
            <FollowButton
              userId={profile.userId}
              isFollowing={Boolean(profile.isFollowing)}
              isSelf={false}
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
          </View>
        ) : null}

        {profile.styleTags.length > 0 ? (
          <View style={styles.tagRow}>
            {profile.styleTags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>公開プラン</Text>
      {plans.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>まだ公開プランがありません</Text>
        </View>
      ) : (
        plans.map((plan, index) => (
          <PublicPlanCard
            key={plan.id}
            plan={plan}
            index={index}
            currentUserId={currentUserId}
            onPress={() => router.push(`/public-plan/${plan.id}`)}
            onCreatorPress={() => {}}
            onFollowChange={() => void loadProfile()}
          />
        ))
      )}
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
    marginBottom: Spacing.two,
  },
  backButtonText: {
    color: accent,
    fontSize: 16,
    fontWeight: '600',
  },
  hero: {
    alignItems: 'center',
    marginBottom: Spacing.five,
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: -10,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: NS.colors.accentGlow,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 2,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  avatarText: {
    color: accent,
    fontSize: 34,
    fontWeight: '800',
  },
  displayName: {
    color: NS.colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  bio: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: Spacing.three,
    maxWidth: 340,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  statBlock: {
    minWidth: 88,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  statValue: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  followWrap: {
    marginBottom: Spacing.three,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  tag: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  tagText: {
    color: accent,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: Spacing.three,
  },
  emptyBox: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.five,
    alignItems: 'center',
  },
  emptyText: {
    color: NS.colors.textMuted,
    fontSize: 14,
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
});
