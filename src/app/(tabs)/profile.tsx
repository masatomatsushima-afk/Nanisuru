import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BetaTestEntryButton } from '@/components/beta-test-entry-button';
import { NotificationEntryButton } from '@/components/notification-entry-button';
import { ScreenBackground } from '@/components/ui/screen-background';
import { FadeInView } from '@/components/ui/fade-in-view';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { PublicProfileEditor } from '@/components/public-profile-editor';
import { TravelPreferencesEditor } from '@/components/travel-preferences-editor';
import { RatingTendencySection } from '@/components/rating-tendency-section';
import { UserPreferencesSection } from '@/components/user-preferences-section';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getAuthProviderLabel, getUserDisplayName, getUserInitial } from '@/lib/auth';
import { getUserPreferences } from '@/lib/user-memory';
import type { UserPreferences } from '@/types/user-memory';

function ProfileInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, isConfigured, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

  const loadPreferences = useCallback(async () => {
    setUserPreferences(await getUserPreferences());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [loadPreferences]),
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

  if (!user) {
    return (
      <ScreenBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.four,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.five,
          },
        ]}>
        <FadeInView>
        <Text style={styles.eyebrow}>👤 MY PAGE</Text>
        <Text style={styles.title}>マイページ</Text>
        <Text style={styles.subtitle}>あなたの旅の設定と保存プラン</Text>
        </FadeInView>

        <FadeInView delay={80}>
          <PremiumCard style={styles.guestCard}>
            <Text style={styles.guestIcon}>👤</Text>
            <Text style={styles.guestTitle}>ログインしていません</Text>
            <Text style={styles.guestText}>
              アカウントにログインすると、プロフィール情報や保存したプランを確認できます。
            </Text>
            <PrimaryButton label="ログイン" onPress={() => router.push('/login')} />
            <Pressable style={styles.signUpLink} onPress={() => router.push('/sign-up')}>
              <Text style={styles.signUpLinkText}>新規登録はこちら</Text>
            </Pressable>
          </PremiumCard>
        </FadeInView>

        <FadeInView delay={105}>
          <BetaTestEntryButton />
        </FadeInView>

        {userPreferences ? (
          <FadeInView delay={120}>
            <UserPreferencesSection preferences={userPreferences} />
          </FadeInView>
        ) : null}

        <FadeInView delay={140}>
          <RatingTendencySection isLoggedIn={false} isConfigured={isConfigured} />
        </FadeInView>

        <FadeInView delay={150}>
          <PublicProfileEditor
            isLoggedIn={false}
            isConfigured={isConfigured}
            onRequireLogin={() => router.push('/login')}
          />
        </FadeInView>

        <FadeInView delay={160}>
          <TravelPreferencesEditor
            isLoggedIn={false}
            isConfigured={isConfigured}
            onRequireLogin={() => router.push('/login')}
          />
        </FadeInView>
      </ScrollView>
      </ScreenBackground>
    );
  }

  const displayName = getUserDisplayName(user);
  const providerLabel = getAuthProviderLabel(user);
  const joinedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  return (
    <ScreenBackground>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.four,
          paddingBottom: insets.bottom + BottomTabInset + Spacing.five,
        },
      ]}
      showsVerticalScrollIndicator={false}>
      <FadeInView>
        <Text style={styles.eyebrow}>👤 MY PAGE</Text>
        <Text style={styles.title}>マイページ</Text>
        <Text style={styles.subtitle}>プロフィール・設定・旅の好みを管理</Text>
      </FadeInView>

      <FadeInView delay={50}>
        <BetaTestEntryButton />
      </FadeInView>

      <FadeInView delay={40}>
        <NotificationEntryButton isConfigured={isConfigured} />
      </FadeInView>

      <FadeInView delay={60}>
        <PremiumCard style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getUserInitial(user)}</Text>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.email}>{user.email ?? 'メールアドレス非公開'}</Text>
          <View style={styles.providerBadge}>
            <Text style={styles.providerBadgeText}>{providerLabel}でログイン中</Text>
          </View>
        </PremiumCard>
      </FadeInView>

      <FadeInView delay={120}>
        <PremiumCard style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>アカウント情報</Text>
          <ProfileInfoRow label="表示名" value={displayName} />
          <ProfileInfoRow label="メール" value={user.email ?? '非公開'} />
          <ProfileInfoRow label="ログイン方法" value={providerLabel} />
          <ProfileInfoRow label="登録日" value={joinedDate} />
        </PremiumCard>
      </FadeInView>

      {userPreferences ? (
        <FadeInView delay={150}>
          <UserPreferencesSection preferences={userPreferences} />
        </FadeInView>
      ) : null}

      <FadeInView delay={155}>
        <RatingTendencySection isLoggedIn isConfigured={isConfigured} />
      </FadeInView>

      <FadeInView delay={162}>
        <PublicProfileEditor
          isLoggedIn
          isConfigured={isConfigured}
          onRequireLogin={() => router.push('/login')}
        />
      </FadeInView>

      <FadeInView delay={165}>
        <TravelPreferencesEditor
          isLoggedIn
          isConfigured={isConfigured}
          onRequireLogin={() => router.push('/login')}
        />
      </FadeInView>

      <FadeInView delay={168}>
        <PremiumCard style={styles.memoriesCard}>
          <Text style={styles.memoriesEmoji}>📔</Text>
          <Text style={styles.sectionTitle}>思い出</Text>
          <Text style={styles.memoriesText}>
            旅の写真・動画・メモをアルバム形式で残せます。2026年の思い出もここから振り返れます。
          </Text>
          <PrimaryButton label="思い出アルバムを見る" onPress={() => router.push('/memories')} />
        </PremiumCard>
      </FadeInView>

      <FadeInView delay={170}>
        <PremiumCard style={styles.memoriesCard}>
          <Text style={styles.memoriesEmoji}>✨</Text>
          <Text style={styles.sectionTitle}>公開プロフィール</Text>
          <Text style={styles.memoriesText}>
            あなたの公開プラン・思い出・穴場が、他のユーザーからどう見えるか確認できます。
          </Text>
          <PrimaryButton
            label="公開プロフィールを見る"
            onPress={() => router.push(`/creator/${user.id}`)}
          />
        </PremiumCard>
      </FadeInView>

      {!isConfigured ? (
        <FadeInView delay={160}>
          <View style={styles.notice}>
            <Text style={styles.noticeText}>Supabaseの設定を確認してください</Text>
          </View>
        </FadeInView>
      ) : null}

      <FadeInView delay={180}>
        <View style={styles.signOutWrap}>
          <PrimaryButton
            label={isSigningOut ? 'ログアウト中...' : 'ログアウト'}
            onPress={handleSignOut}
            disabled={isSigningOut}
            variant="secondary"
          />
        </View>
      </FadeInView>
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
  },
  eyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.two,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.title,
    marginBottom: Spacing.two,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    marginBottom: Spacing.five,
  },
  profileCard: {
    padding: Spacing.five,
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 2,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  avatarText: {
    color: NS.colors.accent,
    fontSize: 32,
    fontWeight: '800',
  },
  displayName: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.one,
  },
  email: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    marginBottom: Spacing.three,
  },
  providerBadge: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  providerBadgeText: {
    color: NS.colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  detailsCard: {
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.three,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: NS.colors.border,
  },
  infoLabel: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  infoValue: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1.2,
    textAlign: 'right',
  },
  guestCard: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
  },
  guestIcon: {
    fontSize: 48,
  },
  guestTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
  },
  guestText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.two,
  },
  signUpLink: {
    paddingVertical: Spacing.two,
  },
  signUpLinkText: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  notice: {
    backgroundColor: NS.colors.dangerSoft,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    marginBottom: Spacing.four,
  },
  noticeText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  memoriesCard: {
    padding: Spacing.four,
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  memoriesEmoji: {
    fontSize: 28,
  },
  memoriesText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  signOutWrap: {
    marginTop: Spacing.two,
  },
});
