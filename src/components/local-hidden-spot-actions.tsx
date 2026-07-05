import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { LocalGemAddToPlanSheet } from '@/components/local-gem-add-to-plan-sheet';
import { SuccessOverlay } from '@/components/success-overlay';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  toggleLocalHiddenSpotLike,
  toggleLocalHiddenSpotSave,
} from '@/lib/local-hidden-spots';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';

type LocalHiddenSpotActionsProps = {
  spot: LocalHiddenSpot;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
  onSpotUpdate: (spot: LocalHiddenSpot) => void;
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
}: LocalHiddenSpotActionsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);

  const runToggle = async (key: string, action: () => Promise<LocalHiddenSpot>) => {
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

  const openUrl = (url: string, label: string) => {
    if (!url.trim()) return;
    void Linking.openURL(url.trim()).catch(() => {
      Alert.alert('エラー', `${label}を開けませんでした`);
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <ActionButton
          label={spot.savedByMe ? `保存済み ${spot.saveCount}` : `保存 ${spot.saveCount}`}
          active={spot.savedByMe}
          disabled={busy === 'save'}
          onPress={() => runToggle('save', () => toggleLocalHiddenSpotSave(spot.id))}
        />
        <ActionButton
          label={spot.likedByMe ? `♥ ${spot.likeCount}` : `♡ ${spot.likeCount}`}
          active={spot.likedByMe}
          disabled={busy === 'like'}
          onPress={() => runToggle('like', () => toggleLocalHiddenSpotLike(spot.id))}
        />
      </View>

      <View style={styles.row}>
        {spot.googleMapsUrl.trim() ? (
          <ActionButton
            label="Google Mapsで開く"
            onPress={() => openUrl(spot.googleMapsUrl, 'Google Maps')}
          />
        ) : null}
        {spot.instagramUrl.trim() ? (
          <ActionButton
            label="Instagramで見る"
            onPress={() => openUrl(spot.instagramUrl, 'Instagram')}
          />
        ) : null}
        {spot.tiktokUrl.trim() ? (
          <ActionButton label="TikTokで見る" onPress={() => openUrl(spot.tiktokUrl, 'TikTok')} />
        ) : null}
      </View>

      <ActionButton
        label="この場所をプランに追加"
        onPress={() => {
          if (!isLoggedIn) {
            onRequireLogin();
            return;
          }
          if (spot.id.startsWith('sample:')) {
            Alert.alert('サンプルデータ', '保存済みプランへの追加は、実際の投稿データでお試しください。');
            return;
          }
          setShowAddSheet(true);
        }}
      />

      <LocalGemAddToPlanSheet
        visible={showAddSheet}
        spot={spot}
        onClose={() => setShowAddSheet(false)}
        onAdded={() => {
          setSuccess('プランに追加しました');
          setTimeout(() => setSuccess(null), 1600);
        }}
      />

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
