import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { SuccessOverlay } from '@/components/success-overlay';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  toggleLocalHiddenSpotLike,
  toggleLocalHiddenSpotSave,
  toggleLocalHiddenSpotWant,
} from '@/lib/local-hidden-spots';
import { setPendingLocalSpotForPlan } from '@/lib/plan-local-spot-intent';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';

type LocalHiddenSpotActionsProps = {
  spot: LocalHiddenSpot;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
  onSpotUpdate: (spot: LocalHiddenSpot) => void;
  onAddToPlan?: () => void;
};

function ActionButton({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionButton,
        active && styles.actionButtonActive,
        pressed && styles.actionButtonPressed,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}>
      <Text style={[styles.actionLabel, active && styles.actionLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function LocalHiddenSpotActions({
  spot,
  isLoggedIn,
  onRequireLogin,
  onSpotUpdate,
  onAddToPlan,
}: LocalHiddenSpotActionsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const runToggle = async (
    key: string,
    action: () => Promise<LocalHiddenSpot>,
  ) => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    setBusy(key);
    try {
      onSpotUpdate(await action());
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : '操作に失敗しました');
    } finally {
      setBusy(null);
    }
  };

  const handleAddToPlan = async () => {
    await setPendingLocalSpotForPlan({
      spotId: spot.id,
      name: spot.name,
      area: spot.area,
    });
    setSuccess('プラン作成画面に追加しました');
    setTimeout(() => setSuccess(null), 1600);
    onAddToPlan?.();
  };

  const handleMaps = () => {
    if (!spot.googleMapsUrl.trim()) return;
    void Linking.openURL(spot.googleMapsUrl.trim());
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <ActionButton
          label={spot.likedByMe ? `❤️ ${spot.likeCount}` : `🤍 ${spot.likeCount}`}
          active={spot.likedByMe}
          disabled={busy === 'like'}
          onPress={() => runToggle('like', () => toggleLocalHiddenSpotLike(spot.id))}
        />
        <ActionButton
          label={spot.savedByMe ? `🔖 保存済 ${spot.saveCount}` : `🔖 ${spot.saveCount}`}
          active={spot.savedByMe}
          disabled={busy === 'save'}
          onPress={() => runToggle('save', () => toggleLocalHiddenSpotSave(spot.id))}
        />
        <ActionButton
          label={spot.wantedByMe ? `👀 行きたい ${spot.wantCount}` : `👀 ${spot.wantCount}`}
          active={spot.wantedByMe}
          disabled={busy === 'want'}
          onPress={() => runToggle('want', () => toggleLocalHiddenSpotWant(spot.id))}
        />
      </View>

      <View style={styles.row}>
        <ActionButton label="🗓 プランに追加" onPress={handleAddToPlan} />
        {spot.googleMapsUrl.trim() ? (
          <ActionButton label="🗺 Maps" onPress={handleMaps} />
        ) : null}
      </View>

      <SuccessOverlay visible={Boolean(success)} message={success ?? ''} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actionButton: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  actionButtonActive: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  actionButtonPressed: {
    opacity: 0.88,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionLabel: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  actionLabelActive: {
    color: NS.colors.accent,
  },
});
