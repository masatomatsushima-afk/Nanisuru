import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FollowButton } from '@/components/follow-button';
import { VisualCover } from '@/components/ui/visual-cover';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { getProfileInitial, type UserProfile } from '@/types/user-profile';

type ProfileHeaderProps = {
  profile: UserProfile;
  isLoggedIn: boolean;
  savedCount?: number;
  onRequireLogin: () => void;
  onFollowChange: (next: { isFollowing: boolean; followerCount: number }) => void;
  onEditPress?: () => void;
};

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function ProfileHeader({
  profile,
  isLoggedIn,
  savedCount = 0,
  onRequireLogin,
  onFollowChange,
  onEditPress,
}: ProfileHeaderProps) {
  const isSelf = profile.isSelf;
  const coverTheme = profile.styleTags[0] ?? 'travel';

  return (
    <View style={styles.wrap}>
      <View style={styles.coverCard}>
        <VisualCover
          height={112}
          theme="scenery"
          category={coverTheme}
          seed={profile.userId}
          overlay="full"
          showEmoji={false}
          borderRadius={NS.radius.xl}
        />
        <View style={styles.avatarFloating}>
          {profile.avatarUrl ? (
            <Image
              source={{ uri: profile.avatarUrl }}
              style={styles.avatarImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getProfileInitial(profile.displayName)}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.infoBlock}>
        <Text style={styles.displayName}>{profile.displayName}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        <View style={styles.statsRow}>
          <StatPill label="公開プラン" value={profile.publicPlanCount ?? 0} />
          <StatPill label="思い出" value={profile.publicMemoryCount ?? 0} />
          <StatPill label="保存数" value={savedCount} />
          <StatPill label="フォロー数" value={profile.followingCount} />
        </View>

        {profile.styleTags.length > 0 ? (
          <View style={styles.tagRow}>
            {profile.styleTags.slice(0, 4).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.followMeta}>
          フォロー中 {profile.followingCount} · 公開プラン {profile.publicPlanCount ?? 0}件
        </Text>

        <View style={styles.actionRow}>
          {isSelf ? (
            <Pressable
              style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
              onPress={onEditPress}>
              <Text style={styles.editBtnText}>プロフィールを編集</Text>
            </Pressable>
          ) : (
            <FollowButton
              userId={profile.userId}
              isFollowing={Boolean(profile.isFollowing)}
              isSelf={false}
              isLoggedIn={isLoggedIn}
              onRequireLogin={onRequireLogin}
              onFollowChange={onFollowChange}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  coverCard: {
    position: 'relative',
    borderRadius: NS.lifestyle.heroRadius,
    overflow: 'hidden',
    ...NS.shadow.cardLg,
    shadowOpacity: 0.12,
  },
  avatarFloating: {
    position: 'absolute',
    left: Spacing.three,
    bottom: -28,
    zIndex: 2,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: NS.colors.bgElevated,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...NS.shadow.card,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    color: NS.colors.accent,
    fontSize: 28,
    fontWeight: '800',
  },
  infoBlock: {
    paddingTop: 34,
    gap: Spacing.two,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  statPill: {
    minWidth: 68,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: NS.radius.md,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    ...NS.shadow.card,
    shadowOpacity: 0.05,
  },
  statValue: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  statLabel: {
    color: NS.colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  displayName: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  bio: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  tag: {
    backgroundColor: NS.colors.coralSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.coral,
  },
  tagText: {
    color: NS.colors.coral,
    fontSize: 11,
    fontWeight: '700',
  },
  followMeta: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    alignSelf: 'stretch',
  },
  editBtn: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  editBtnPressed: {
    opacity: 0.88,
  },
  editBtnText: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
});
