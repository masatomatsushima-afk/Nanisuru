import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { toggleFollowUser } from '@/lib/user-profiles';

type FollowButtonProps = {
  userId: string;
  isFollowing: boolean;
  isSelf: boolean;
  isLoggedIn: boolean;
  compact?: boolean;
  onRequireLogin: () => void;
  onFollowChange?: (next: { isFollowing: boolean; followerCount: number }) => void;
};

export function FollowButton({
  userId,
  isFollowing,
  isSelf,
  isLoggedIn,
  compact = false,
  onRequireLogin,
  onFollowChange,
}: FollowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(isFollowing);

  useEffect(() => {
    setFollowing(isFollowing);
  }, [isFollowing]);

  if (isSelf) return null;

  const handlePress = async () => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    setLoading(true);
    try {
      const result = await toggleFollowUser(userId);
      setFollowing(result.isFollowing);
      onFollowChange?.(result);
    } catch (error) {
      Alert.alert(
        'エラー',
        error instanceof Error ? error.message : 'フォロー操作に失敗しました',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        following && styles.buttonFollowing,
        pressed && styles.buttonPressed,
        loading && styles.buttonDisabled,
      ]}
      onPress={() => void handlePress()}
      disabled={loading}>
      <Text
        style={[
          styles.label,
          compact && styles.labelCompact,
          following && styles.labelFollowing,
        ]}>
        {loading ? '...' : following ? 'フォロー中' : 'フォロー'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: {
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 6,
  },
  buttonFollowing: {
    backgroundColor: NS.colors.bgInput,
    borderColor: NS.colors.borderStrong,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  label: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  labelCompact: {
    fontSize: 11,
  },
  labelFollowing: {
    color: NS.colors.textSecondary,
  },
});
