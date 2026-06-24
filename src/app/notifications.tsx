import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RequireAuthGate } from '@/components/require-auth-gate';
import { PremiumCard } from '@/components/ui/premium-card';
import { ErrorStateCard } from '@/components/ui/state-cards';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import {
  fetchNotifications,
  formatNotificationTime,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications';
import {
  NOTIFICATION_TYPE_ICONS,
  type AppNotification,
} from '@/types/notification';

function NotificationItem({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.item,
        !notification.isRead && styles.itemUnread,
        pressed && styles.itemPressed,
      ]}
      onPress={onPress}>
      <View style={[styles.itemIconWrap, !notification.isRead && styles.itemIconWrapUnread]}>
        <Text style={styles.itemIcon}>{NOTIFICATION_TYPE_ICONS[notification.type]}</Text>
      </View>
      <View style={styles.itemBody}>
        <View style={styles.itemHeader}>
          <Text style={[styles.itemTitle, !notification.isRead && styles.itemTitleUnread]}>
            {notification.title}
          </Text>
          {!notification.isRead ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.itemMessage}>{notification.message}</Text>
        <Text style={styles.itemTime}>{formatNotificationTime(notification.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user, isLoading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async (refresh = false) => {
    if (!user) return;

    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      setNotifications(await fetchNotifications());
    } catch (err) {
      setError(err instanceof Error ? err.message : '通知の取得に失敗しました');
      setNotifications([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return;
    void loadNotifications();
  }, [authLoading, user, loadNotifications]);

  const handlePress = async (notification: AppNotification) => {
    if (!notification.isRead) {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item,
        ),
      );
    }

    if (notification.relatedPlanId) {
      router.push(`/public-plan/${notification.relatedPlanId}`);
      return;
    }

    if (notification.relatedUserId) {
      router.push(`/creator/${notification.relatedUserId}`);
    }
  };

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : '既読処理に失敗しました');
    } finally {
      setIsMarkingAll(false);
    }
  };

  const hasUnread = notifications.some((item) => !item.isRead);

  return (
    <RequireAuthGate
      title="通知を見るにはログインが必要です"
      description="いいね・保存・コメント・フォローの通知は、ログイン後に確認できます。"
      loadingMessage="確認中...">
      <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.three,
          paddingBottom: insets.bottom + Spacing.six,
        },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadNotifications(true)}
          tintColor={NS.colors.accent}
        />
      }>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← 戻る</Text>
      </Pressable>

      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>NOTIFICATIONS</Text>
          <Text style={styles.title}>通知</Text>
        </View>
        {hasUnread ? (
          <Pressable
            style={({ pressed }) => [styles.markAllButton, pressed && styles.markAllPressed]}
            onPress={() => void handleMarkAllRead()}
            disabled={isMarkingAll}>
            <Text style={styles.markAllText}>
              {isMarkingAll ? '処理中...' : 'すべて既読にする'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={NS.colors.accent} />
          <Text style={styles.loadingText}>通知を読み込み中...</Text>
        </View>
      ) : error ? (
        <ErrorStateCard message={error} onRetry={() => void loadNotifications()} />
      ) : notifications.length === 0 ? (
        <PremiumCard style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>まだ通知はありません</Text>
          <Text style={styles.emptyText}>
            プランへのいいね・保存・コメントやフォローがあると、ここに表示されます。
          </Text>
        </PremiumCard>
      ) : (
        <View style={styles.list}>
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onPress={() => void handlePress(notification)}
            />
          ))}
        </View>
      )}
      </ScrollView>
    </RequireAuthGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NS.colors.bg,
  },
  content: {
    paddingHorizontal: Spacing.four,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingRight: Spacing.three,
    marginBottom: Spacing.two,
  },
  backButtonText: {
    color: NS.colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  eyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.one,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.title,
  },
  markAllButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  markAllPressed: {
    opacity: 0.88,
  },
  markAllText: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
  },
  noticeCard: {
    padding: Spacing.four,
  },
  errorText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.three,
  },
  emptyCard: {
    padding: Spacing.five,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: Spacing.three,
  },
  emptyTitle: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  emptyText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  list: {
    gap: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    gap: Spacing.three,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.four,
  },
  itemUnread: {
    backgroundColor: NS.colors.bgCard,
    borderColor: NS.colors.accentBorder,
  },
  itemPressed: {
    opacity: 0.92,
  },
  itemIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: NS.colors.bgInput,
    borderWidth: 1,
    borderColor: NS.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconWrapUnread: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  itemIcon: {
    fontSize: 18,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  itemTitle: {
    flex: 1,
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  itemTitleUnread: {
    color: NS.colors.text,
    fontWeight: '800',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: NS.colors.accent,
  },
  itemMessage: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  itemTime: {
    color: NS.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
