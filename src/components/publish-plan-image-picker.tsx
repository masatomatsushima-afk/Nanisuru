import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  PUBLIC_PLAN_IMAGE_MAX_COUNT,
  type PublishPlanImageDraft,
} from '@/types/public-plan-image';

type PublishPlanImagePickerProps = {
  images: PublishPlanImageDraft[];
  onChange: (images: PublishPlanImageDraft[]) => void;
};

function getDraftPreviewUri(draft: PublishPlanImageDraft): string | undefined {
  return draft.localUri ?? draft.imageUrl;
}

export function PublishPlanImagePicker({ images, onChange }: PublishPlanImagePickerProps) {
  const canAddMore = images.length < PUBLIC_PLAN_IMAGE_MAX_COUNT;

  const handleAddImages = async () => {
    if (!canAddMore) {
      Alert.alert('上限に達しました', `画像は最大${PUBLIC_PLAN_IMAGE_MAX_COUNT}枚まで追加できます。`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('写真へのアクセス', '写真ライブラリへのアクセスを許可してください。');
      return;
    }

    const remaining = PUBLIC_PLAN_IMAGE_MAX_COUNT - images.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });

    if (result.canceled || result.assets.length === 0) return;

    const next = [...images];
    for (const asset of result.assets.slice(0, remaining)) {
      next.push({
        key: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        localUri: asset.uri,
        orderIndex: next.length,
      });
    }

    onChange(next.map((item, index) => ({ ...item, orderIndex: index })));
  };

  const handleRemove = (key: string) => {
    Alert.alert('写真を削除', 'この写真を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          const next = images
            .filter((item) => item.key !== key)
            .map((item, index) => ({ ...item, orderIndex: index }));
          onChange(next);
        },
      },
    ]);
  };

  const handleReplace = async (key: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('写真へのアクセス', '写真ライブラリへのアクセスを許可してください。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    onChange(
      images.map((item) =>
        item.key === key
          ? {
              ...item,
              localUri: result.assets[0].uri,
              imageUrl: undefined,
              storagePath: undefined,
            }
          : item,
      ),
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>写真を追加</Text>
        <Text style={styles.countText}>
          {images.length}/{PUBLIC_PLAN_IMAGE_MAX_COUNT}
        </Text>
      </View>
      <Text style={styles.hint}>雰囲気が伝わる写真を1〜5枚追加できます（動画は未対応）</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {images.map((draft, index) => {
          const previewUri = getDraftPreviewUri(draft);
          return (
            <View key={draft.key} style={styles.thumbWrap}>
              {previewUri ? (
                <Image source={{ uri: previewUri }} style={styles.thumbImage} contentFit="cover" />
              ) : (
                <View style={styles.thumbFallback} />
              )}
              <View style={styles.thumbBadge}>
                <Text style={styles.thumbBadgeText}>{index + 1}</Text>
              </View>
              <View style={styles.thumbActions}>
                <Pressable style={styles.thumbActionButton} onPress={() => void handleReplace(draft.key)}>
                  <Text style={styles.thumbActionText}>変更</Text>
                </Pressable>
                <Pressable
                  style={[styles.thumbActionButton, styles.thumbDeleteButton]}
                  onPress={() => handleRemove(draft.key)}>
                  <Text style={styles.thumbDeleteText}>削除</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {canAddMore ? (
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            onPress={() => void handleAddImages()}>
            <Text style={styles.addEmoji}>📷</Text>
            <Text style={styles.addLabel}>写真を追加</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const THUMB_SIZE = 132;

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  countText: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  hint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  row: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  thumbWrap: {
    width: THUMB_SIZE,
    borderRadius: NS.radius.md,
    overflow: 'hidden',
    backgroundColor: NS.colors.bgElevated,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  thumbImage: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  thumbFallback: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    backgroundColor: NS.colors.bgInput,
  },
  thumbBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: NS.radius.pill,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  thumbBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  thumbActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
  },
  thumbActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: NS.colors.bgInput,
  },
  thumbDeleteButton: {
    borderLeftWidth: 1,
    borderLeftColor: NS.colors.border,
  },
  thumbActionText: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  thumbDeleteText: {
    color: NS.colors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  addButton: {
    width: THUMB_SIZE,
    height: THUMB_SIZE + 35,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    backgroundColor: NS.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addButtonPressed: {
    opacity: 0.88,
  },
  addEmoji: {
    fontSize: 24,
  },
  addLabel: {
    color: NS.colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
});
