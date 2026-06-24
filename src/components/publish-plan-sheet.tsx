import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SuccessOverlay } from '@/components/success-overlay';
import { PublishPlanImagePicker } from '@/components/publish-plan-image-picker';
import { PublishPlanVideoLinks } from '@/components/publish-plan-video-links';
import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { draftsFromPublicPlanImages } from '@/lib/public-plan-images';
import { draftsFromPublicPlanVideos, validateVideoDrafts } from '@/lib/public-plan-videos';
import { getPublishedPlanForTrip, parseTagsInput, publishPublicPlan } from '@/lib/public-plans';
import type { SavedTrip } from '@/types/trip';
import type { PublishPlanImageDraft } from '@/types/public-plan-image';
import type { PublishPlanVideoDraft } from '@/types/public-plan-video';
import {
  companionToDefaultCategory,
  PUBLIC_PLAN_CATEGORIES,
  PUBLIC_PLAN_VISIBILITY_OPTIONS,
  type PublicPlanCategory,
  type PublicPlanVisibility,
} from '@/types/public-plan';

type PublishPlanSheetProps = {
  visible: boolean;
  trip: SavedTrip;
  onClose: () => void;
  onPublished?: () => void;
};

function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
      ]}
      onPress={onPress}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function PublishPlanSheet({ visible, trip, onClose, onPublished }: PublishPlanSheetProps) {
  const insets = useSafeAreaInsets();
  const { payload } = trip;

  const [title, setTitle] = useState(trip.title);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PublicPlanCategory>(
    companionToDefaultCategory(payload.companion),
  );
  const [tagsInput, setTagsInput] = useState('');
  const [visibility, setVisibility] = useState<PublicPlanVisibility>('public');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isExisting, setIsExisting] = useState(false);
  const [imageDrafts, setImageDrafts] = useState<PublishPlanImageDraft[]>([]);
  const [videoDrafts, setVideoDrafts] = useState<PublishPlanVideoDraft[]>([]);

  useEffect(() => {
    if (!visible) return;

    setTitle(trip.title);
    setDescription('');
    setCategory(companionToDefaultCategory(payload.companion));
    setTagsInput('');
    setVisibility('public');
    setError(null);
    setImageDrafts([]);
    setVideoDrafts([]);

    void getPublishedPlanForTrip(trip.id).then((existing) => {
      if (!existing) {
        setIsExisting(false);
        return;
      }
      setIsExisting(true);
      setTitle(existing.title);
      setDescription(existing.description);
      setCategory(existing.category);
      setTagsInput(existing.tags.join('、'));
      setVisibility(existing.visibility);
      setImageDrafts(draftsFromPublicPlanImages(existing.images ?? []));
      setVideoDrafts(draftsFromPublicPlanVideos(existing.videos ?? []));
    });
  }, [visible, trip.id, trip.title, payload.companion]);

  const handlePublish = async () => {
    if (!title.trim()) {
      setError('公開タイトルを入力してください');
      return;
    }

    const videoError = validateVideoDrafts(videoDrafts);
    if (videoError) {
      setError(videoError);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await publishPublicPlan({
        sourceTripId: trip.id,
        title: title.trim(),
        description: description.trim(),
        category,
        tags: parseTagsInput(tagsInput),
        visibility,
        payload,
        imageDrafts,
        videoDrafts,
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onPublished?.();
        onClose();
      }, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : '公開に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SuccessOverlay
        visible={showSuccess}
        message={isExisting ? '公開設定を更新しました' : 'プランを公開しました'}
      />
      <View style={[styles.container, { paddingTop: insets.top + Spacing.two }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.cancelText}>キャンセル</Text>
          </Pressable>
          <Text style={styles.headerTitle}>プランを公開</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + Spacing.five },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>
            コミュニティの「発見」タブに投稿して、他のユーザーとプランを共有できます。
          </Text>

          <PublishPlanImagePicker images={imageDrafts} onChange={setImageDrafts} />

          <PublishPlanVideoLinks videos={videoDrafts} onChange={setVideoDrafts} />

          <Text style={styles.label}>公開タイトル</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="例：渋谷デートで巡る静かなカフェコース"
            placeholderTextColor={NS.colors.textMuted}
          />

          <Text style={styles.label}>説明文</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="プランの魅力やおすすめポイントを書いてください"
            placeholderTextColor={NS.colors.textMuted}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>カテゴリ</Text>
          <View style={styles.chipGrid}>
            {PUBLIC_PLAN_CATEGORIES.map((item) => (
              <OptionChip
                key={item}
                label={item}
                selected={category === item}
                onPress={() => setCategory(item)}
              />
            ))}
          </View>

          <Text style={styles.label}>タグ</Text>
          <TextInput
            style={styles.input}
            value={tagsInput}
            onChangeText={setTagsInput}
            placeholder="例：カフェ、雨の日、夜景（カンマ区切り）"
            placeholderTextColor={NS.colors.textMuted}
          />

          <Text style={styles.label}>公開範囲</Text>
          <View style={styles.visibilityList}>
            {PUBLIC_PLAN_VISIBILITY_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={({ pressed }) => [
                  styles.visibilityOption,
                  visibility === option.value && styles.visibilityOptionSelected,
                  pressed && styles.chipPressed,
                ]}
                onPress={() => setVisibility(option.value)}>
                <Text
                  style={[
                    styles.visibilityLabel,
                    visibility === option.value && styles.visibilityLabelSelected,
                  ]}>
                  {option.label}
                </Text>
                <Text style={styles.visibilityDescription}>{option.description}</Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PrimaryButton
            label={isSaving ? '公開中...' : isExisting ? '公開設定を更新' : 'このプランを公開する'}
            onPress={() => void handlePublish()}
            disabled={isSaving}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NS.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: NS.colors.border,
  },
  cancelText: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 64,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  lead: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.two,
  },
  label: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: Spacing.two,
  },
  input: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    color: NS.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  textArea: {
    minHeight: 110,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  chipSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  chipLabelSelected: {
    color: NS.colors.accent,
  },
  visibilityList: {
    gap: Spacing.two,
  },
  visibilityOption: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.three,
  },
  visibilityOptionSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  visibilityLabel: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  visibilityLabelSelected: {
    color: NS.colors.accent,
  },
  visibilityDescription: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: NS.colors.danger,
    fontSize: 13,
    marginTop: Spacing.two,
  },
});
