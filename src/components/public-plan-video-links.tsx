import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  getVideoPlatformButtonLabel,
  getVideoPlatformIcon,
  type PublicPlanVideo,
} from '@/types/public-plan-video';

type PublicPlanVideoLinksProps = {
  videos?: PublicPlanVideo[];
  variant?: 'detail' | 'compact';
};

async function openVideoUrl(url: string): Promise<void> {
  await Linking.openURL(url);
}

export function PublicPlanVideoLinks({
  videos = [],
  variant = 'detail',
}: PublicPlanVideoLinksProps) {
  const sorted = [...videos].sort((a, b) => a.orderIndex - b.orderIndex);
  if (sorted.length === 0) return null;

  if (variant === 'compact') {
    return (
      <View style={styles.compactWrap}>
        {sorted.slice(0, 2).map((video) => (
          <Pressable
            key={video.id}
            style={({ pressed }) => [styles.compactButton, pressed && styles.buttonPressed]}
            onPress={() => void openVideoUrl(video.videoUrl)}>
            <Text style={styles.compactIcon}>{getVideoPlatformIcon(video.platform)}</Text>
            <Text style={styles.compactLabel} numberOfLines={1}>
              {video.platform}
            </Text>
          </Pressable>
        ))}
        {sorted.length > 2 ? (
          <View style={styles.morePill}>
            <Text style={styles.morePillText}>+{sorted.length - 2}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.detailWrap}>
      <Text style={styles.sectionLabel}>動画で雰囲気をチェック</Text>
      <View style={styles.detailList}>
        {sorted.map((video) => (
          <Pressable
            key={video.id}
            style={({ pressed }) => [styles.detailButton, pressed && styles.buttonPressed]}
            onPress={() => void openVideoUrl(video.videoUrl)}>
            <Text style={styles.detailIcon}>{getVideoPlatformIcon(video.platform)}</Text>
            <Text style={styles.detailLabel}>{getVideoPlatformButtonLabel(video.platform)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  detailWrap: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  sectionLabel: {
    color: NS.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  detailList: {
    gap: Spacing.two,
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.sm,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  detailIcon: {
    fontSize: 16,
  },
  detailLabel: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  compactWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  compactIcon: {
    fontSize: 12,
  },
  compactLabel: {
    color: NS.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  morePill: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  morePillText: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.88,
  },
});
