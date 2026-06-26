import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { PrimaryButton } from '@/components/ui/premium-card';
import { useAuth } from '@/contexts/auth-context';
import {
  createTripFolderFromPayload,
  createTripFolderFromSavedTrip,
  getTripFolderBySavedTripId,
} from '@/lib/trip-folders';
import type { SavedTrip, SavedTripPayload } from '@/types/trip';

type AddTripSecretaryFolderButtonProps =
  | {
      variant: 'saved-trip';
      trip: SavedTrip;
      label?: string;
    }
  | {
      variant: 'plan-payload';
      payload: SavedTripPayload;
      title?: string;
      label?: string;
    };

export function AddTripSecretaryFolderButton(props: AddTripSecretaryFolderButtonProps) {
  const { session, isConfigured } = useAuth();
  const [busy, setBusy] = useState(false);
  const label =
    props.label ??
    (props.variant === 'saved-trip' ? '旅行秘書フォルダに追加' : 'この旅行の秘書を作る');

  const handlePress = async () => {
    if (!session) {
      router.push('/login');
      return;
    }
    if (!isConfigured) {
      Alert.alert('Supabase未設定', '旅行秘書フォルダには Supabase の設定が必要です。');
      return;
    }

    setBusy(true);
    try {
      if (props.variant === 'saved-trip') {
        const existing = await getTripFolderBySavedTripId(props.trip.id);
        if (existing) {
          Alert.alert('追加済み', 'このプランはすでに旅行秘書フォルダにあります。', [
            { text: 'OK' },
            { text: '秘書を開く', onPress: () => router.push('/(tabs)/ai') },
          ]);
          return;
        }
        await createTripFolderFromSavedTrip(props.trip);
      } else {
        await createTripFolderFromPayload(props.payload, props.title);
      }

      Alert.alert('作成しました', 'AI旅行秘書タブでこの旅行フォルダを選んで相談できます。', [
        { text: 'OK' },
        { text: '秘書を開く', onPress: () => router.push('/(tabs)/ai') },
      ]);
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : 'フォルダの作成に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PrimaryButton
      label={busy ? '作成中...' : label}
      onPress={() => void handlePress()}
      disabled={busy}
      variant="secondary"
    />
  );
}
