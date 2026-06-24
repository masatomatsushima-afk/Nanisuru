import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getUnreadNotificationCount } from '@/lib/notifications';

type NotificationEntryButtonProps = {
  isConfigured: boolean;
};

export function NotificationEntryButton({ isConfigured }: NotificationEntryButtonProps) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!isConfigured || !user) {
      setUnreadCount(0);
      return;
    }
    try {
      setUnreadCount(await getUnreadNotificationCount());
    } catch {
      setUnreadCount(0);
    }
  }, [isConfigured, user]);

  useFocusEffect(
    useCallback(() => {
      void loadUnread();
    }, [loadUnread]),
  );

  if (!user) return null;

  return (
    <PremiumCard style={styles.card} onPress={() => router.push('/notifications')}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🔔</Text>
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>通知</Text>
          <Text style={styles.subtitle}>
            {unreadCount > 0 ? `${unreadCount}件の未読があります` : 'いいね・保存・コメントなどを確認'}
          </Text>
        </View>
        <Text style={styles.chevron}>→</Text>
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconWrap: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: NS.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: NS.colors.bgElevated,
  },
  badgeText: {
    color: NS.colors.bg,
    fontSize: 10,
    fontWeight: '900',
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  chevron: {
    color: NS.colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
});
