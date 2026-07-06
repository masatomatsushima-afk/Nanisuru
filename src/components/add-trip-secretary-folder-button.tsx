import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { PrimaryButton } from '@/components/ui/premium-card';
import { useAuth } from '@/contexts/auth-context';
import { promptAuthRequired } from '@/lib/require-auth';
import {
  createOrAttachTripFolder,
  createTripFolderFromSavedTrip,
  getTripFolderBySavedTripId,
} from '@/lib/trip-folders';
import type { SavedTrip, SavedTripPayload } from '@/types/trip';
import type { TripFolder } from '@/types/trip-folder';

type AddTripSecretaryFolderButtonProps =
  | {
      variant: 'saved-trip';
      trip: SavedTrip;
      label?: string;
      onFolderAttached?: (folder: TripFolder) => void;
    }
  | {
      variant: 'plan-payload';
      payload: SavedTripPayload;
      savedTripId?: string | null;
      title?: string;
      label?: string;
      onFolderAttached?: (folder: TripFolder) => void;
    };

export function AddTripSecretaryFolderButton(props: AddTripSecretaryFolderButtonProps) {
  const { isLoggedIn, isConfigured } = useAuth();
  const [busy, setBusy] = useState(false);
  const label = props.label ?? '旅行秘書フォルダに追加';

  const openAssistant = (folderId: string) => {
    router.push(`/trip-assistant/${folderId}`);
  };

  const showSuccess = (folder: TripFolder) => {
    props.onFolderAttached?.(folder);
    Alert.alert('旅行秘書フォルダに追加しました', 'この旅行の文脈でAI旅行秘書が相談に乗ります。', [
      { text: 'OK' },
      { text: '旅行秘書を開く', onPress: () => openAssistant(folder.id) },
    ]);
  };

  const handlePress = async () => {
    if (!isLoggedIn) {
      promptAuthRequired('createOrGetTripFolder');
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
          const result = await createOrAttachTripFolder({
            payload: props.trip.payload,
            savedTripId: props.trip.id,
            title: props.trip.title,
          });
          showSuccess(result.folder);
          return;
        }
        const folder = await createTripFolderFromSavedTrip(props.trip);
        console.log('[TripFolder] success', { folderId: folder.id, action: 'created-from-trip' });
        showSuccess(folder);
        return;
      }

      const result = await createOrAttachTripFolder({
        payload: props.payload,
        savedTripId: props.savedTripId,
        title: props.title,
      });
      showSuccess(result.folder);
    } catch (error) {
      Alert.alert(
        'エラー',
        error instanceof Error ? error.message : '旅行秘書フォルダへの追加に失敗しました',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <PrimaryButton
      label={busy ? '追加中…' : label}
      onPress={() => void handlePress()}
      disabled={busy}
      variant="secondary"
    />
  );
}
