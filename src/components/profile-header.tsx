import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { FollowButton } from '@/components/follow-button';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { getProfileInitial, type UserProfile } from '@/types/user-profile';

type ProfileHeaderProps = {
  profile: UserProfile;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
  onFollowChange: (next: { isFollowing: boolean; followerCount: number }) => void;
};

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function ProfileHeader({
  profile,
  isLoggedIn,
  onRequireLogin,
  onFollowChange,
}: ProfileHeaderProps) {
  const isSelf = profile.isSelf;

  return (
    <View style={styles.wrap}>
      <View style={styles.heroGlow} />
      <View style={styles.avatarWrap}>
        {profile.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} contentFit="cover" />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getProfileInitial(profile.displayName)}</Text>
          </View>
        )}
      </View>

      <Text style={styles.displayName}>{profile.displayName}</Text>
      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      {profile.styleTags.length > 0 ? (
        <View style={styles.tagRow}>
          {profile.styleTags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <StatBlock label="公開プラン" value={profile.publicPlanCount ?? 0} />
        <StatBlock label="フォロワー" value={profile.followerCount} />
        <StatBlock label="フォロー中" value={profile.followingCount} />
      </View>

      {!isSelf ? (
        <View style={styles.followWrap}>
          <FollowButton
            userId={profile.userId}
            isFollowing={Boolean(profile.isFollowing)}
            isSelf={false}
            isLoggedIn={isLoggedIn}
            onRequireLogin={onRequireLogin}
            onFollowChange={onFollowChange}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginBottom: Spacing.four,
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
  avatarWrap: {
    marginBottom: Spacing.three,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 3,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: NS.colors.accentBorder,
  },
  avatarText: {
    color: NS.colors.accent,
    fontSize: 36,
    fontWeight: '800',
  },
  displayName: {
    color: NS.colors.text,
    fontSize: 24,
    fontWeight: '900',
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
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  tag: {
    backgroundColor: NS.colors.coralSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: NS.colors.coral,
  },
  tagText: {
    color: NS.colors.coral,
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  statBlock: {
    minWidth: 82,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
  },
  statValue: {
    color: NS.colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 2,
  },
  statLabel: {
    color: NS.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  followWrap: {
    marginBottom: Spacing.two,
  },
});
