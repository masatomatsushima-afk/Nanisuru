import { router } from 'expo-router';
import { Alert } from 'react-native';

const DEFAULT_MESSAGE = '保存するにはログインが必要です';

/** Prompt user to log in before a protected action. Never throws. */
export function promptAuthRequired(
  actionName: string,
  options?: {
    message?: string;
    onLater?: () => void;
  },
): void {
  console.log('[Auth] required for action', actionName);

  Alert.alert(options?.message ?? DEFAULT_MESSAGE, 'ログインすると、データを安全に保存できます。', [
    {
      text: 'あとで',
      style: 'cancel',
      onPress: options?.onLater,
    },
    {
      text: 'ログインする',
      onPress: () => router.push('/login'),
    },
  ]);
}

/** Logout confirmation dialog. */
export function confirmSignOut(onConfirm: () => void | Promise<void>): void {
  Alert.alert('ログアウト確認', 'ログアウトしますか？', [
    { text: 'キャンセル', style: 'cancel' },
    {
      text: 'ログアウト',
      style: 'destructive',
      onPress: () => {
        void Promise.resolve(onConfirm()).catch(() => {
          Alert.alert('エラー', '通信に失敗しました');
        });
      },
    },
  ]);
}

/** Show success toast after logout. */
export function showSignedOutMessage(): void {
  Alert.alert('ログアウトしました', 'またのご利用をお待ちしています。');
}
