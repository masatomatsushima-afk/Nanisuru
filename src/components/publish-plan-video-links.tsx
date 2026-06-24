import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  createEmptyVideoDraft,
  detectVideoPlatform,
  parseVideoUrl,
} from '@/lib/public-plan-videos';
import {
  INVALID_VIDEO_URL_MESSAGE,
  PUBLIC_PLAN_VIDEO_MAX_COUNT,
  getVideoPlatformIcon,
  type PublishPlanVideoDraft,
  type VideoPlatform,
} from '@/types/public-plan-video';

type PublishPlanVideoLinksProps = {
  videos: PublishPlanVideoDraft[];
  onChange: (videos: PublishPlanVideoDraft[]) => void;
};

function platformLabel(platform: VideoPlatform | null): string {
  if (!platform) return '未判定';
  return platform;
}

export function PublishPlanVideoLinks({ videos, onChange }: PublishPlanVideoLinksProps) {
  const canAddMore = videos.length < PUBLIC_PLAN_VIDEO_MAX_COUNT;

  const updateVideo = (key: string, videoUrl: string) => {
    onChange(
      videos.map((item) => {
        if (item.key !== key) return item;
        const parsed = parseVideoUrl(videoUrl);
        return {
          ...item,
          videoUrl,
          platform: parsed?.platform ?? detectVideoPlatform(videoUrl) ?? item.platform,
        };
      }),
    );
  };

  const handleAdd = () => {
    if (!canAddMore) return;
    onChange([...videos, createEmptyVideoDraft(videos.length)]);
  };

  const handleRemove = (key: string) => {
    onChange(
      videos
        .filter((item) => item.key !== key)
        .map((item, index) => ({ ...item, orderIndex: index })),
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>動画リンクを追加</Text>
        <Text style={styles.countText}>
          {videos.filter((item) => item.videoUrl.trim()).length}/{PUBLIC_PLAN_VIDEO_MAX_COUNT}
        </Text>
      </View>
      <Text style={styles.hint}>
        Instagram・TikTok・YouTube の動画URLを最大3件追加できます（アプリ内再生は未対応）
      </Text>

      {videos.map((draft, index) => {
        const trimmed = draft.videoUrl.trim();
        const parsed = trimmed ? parseVideoUrl(trimmed) : null;
        const showError = trimmed.length > 0 && !parsed;

        return (
          <View key={draft.key} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowLabel}>
                {getVideoPlatformIcon(parsed?.platform ?? draft.platform)} 動画 {index + 1}
              </Text>
              <Pressable onPress={() => handleRemove(draft.key)} hitSlop={8}>
                <Text style={styles.removeText}>削除</Text>
              </Pressable>
            </View>
            <TextInput
              style={[styles.input, showError && styles.inputError]}
              value={draft.videoUrl}
              onChangeText={(value) => updateVideo(draft.key, value)}
              placeholder="https://www.instagram.com/reel/... など"
              placeholderTextColor={NS.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Text style={[styles.platformText, showError && styles.errorText]}>
              {showError ? INVALID_VIDEO_URL_MESSAGE : `プラットフォーム: ${platformLabel(parsed?.platform ?? null)}`}
            </Text>
          </View>
        );
      })}

      {canAddMore ? (
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          onPress={handleAdd}>
          <Text style={styles.addLabel}>+ 動画リンクを追加</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

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
    gap: Spacing.one,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  removeText: {
    color: NS.colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    color: NS.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  inputError: {
    borderColor: NS.colors.danger,
  },
  platformText: {
    color: NS.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  errorText: {
    color: NS.colors.danger,
    fontWeight: '600',
  },
  addButton: {
    alignSelf: 'flex-start',
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  addButtonPressed: {
    opacity: 0.88,
  },
  addLabel: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
});
