import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SuccessOverlay } from '@/components/success-overlay';
import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { isSupabaseConfigured } from '@/lib/supabase';
import { buildShareMessage, createSharedTrip } from '@/lib/trip-sharing';
import type { ShareTripInput } from '@/types/share';

type ShareTripSectionProps = ShareTripInput & {
  compact?: boolean;
};

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

export function ShareTripSection({
  compact = false,
  ...input
}: ShareTripSectionProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareTitle, setShareTitle] = useState<string | null>(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  const handleCreateLink = async () => {
    if (isSharing) return;

    if (!isSupabaseConfigured()) {
      Alert.alert(
        '設定が必要です',
        'Supabase を設定し、shared_trips テーブルを作成してください。',
      );
      return;
    }

    setIsSharing(true);
    try {
      const shared = await createSharedTrip(input);
      setShareUrl(shared.url);
      setShareTitle(shared.title);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '共有リンクの作成に失敗しました';
      Alert.alert('共有エラー', message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareLink = async () => {
    if (!shareUrl || !shareTitle) return;

    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { message: buildShareMessage(shareTitle, shareUrl), url: shareUrl, title: shareTitle }
          : { message: buildShareMessage(shareTitle, shareUrl), title: shareTitle },
      );
    } catch {
      // User dismissed share sheet
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;

    const copied = await copyToClipboard(shareUrl);
    if (copied) {
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 1600);
      return;
    }

    Alert.alert(
      'リンク',
      `${shareUrl}\n\nリンクを長押ししてコピーできます。`,
    );
  };

  if (compact) {
    return (
      <>
        <SuccessOverlay visible={showCopySuccess} message="共有リンクをコピーしました" />
        {!shareUrl ? (
          <PrimaryButton
            label={isSharing ? 'リンクを作成中...' : '共有リンクを作成'}
            onPress={handleCreateLink}
            disabled={isSharing}
            variant="secondary"
          />
        ) : (
          <View style={styles.compactResult}>
            <Text style={styles.compactUrl} numberOfLines={2}>
              {shareUrl}
            </Text>
            <View style={styles.compactActions}>
              <Pressable style={styles.compactCopyButton} onPress={handleCopyLink}>
                <Text style={styles.compactCopyText}>リンクをコピー</Text>
              </Pressable>
              <Pressable style={styles.compactShareButton} onPress={handleShareLink}>
                <Text style={styles.compactShareText}>共有する</Text>
              </Pressable>
            </View>
          </View>
        )}
      </>
    );
  }

  return (
    <>
      <SuccessOverlay visible={showCopySuccess} message="共有リンクをコピーしました" />
      <View style={styles.section}>
        <Text style={styles.eyebrow}>SHARE</Text>
        <Text style={styles.title}>共有リンクを作成</Text>
        <Text style={styles.description}>
          このプランを公開リンクで共有できます。URLを知っている人だけが閲覧でき、編集はできません。個人情報は含まれません。
        </Text>

        {!shareUrl ? (
          <PrimaryButton
            label={isSharing ? 'リンクを作成中...' : '共有リンクを作成'}
            onPress={handleCreateLink}
            disabled={isSharing}
          />
        ) : (
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>共有URL（閲覧専用）</Text>
            <TextInput
              style={styles.urlInput}
              value={shareUrl}
              editable={false}
              selectTextOnFocus
              multiline
            />
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryAction} onPress={handleCopyLink}>
                <Text style={styles.secondaryActionText}>リンクをコピー</Text>
              </Pressable>
              <Pressable style={styles.primaryAction} onPress={handleShareLink}>
                <Text style={styles.primaryActionText}>共有する</Text>
              </Pressable>
            </View>
            <Pressable style={styles.resetAction} onPress={handleCreateLink} disabled={isSharing}>
              <Text style={styles.resetActionText}>
                {isSharing ? '作成中...' : '新しいリンクを作成'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </>
  );
}

/** Compact share button with inline copy after link creation */
export function ShareTripButton(props: ShareTripInput) {
  return <ShareTripSection {...props} compact />;
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.four,
    gap: Spacing.two,
    ...NS.shadow.card,
  },
  eyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.headline,
  },
  description: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.two,
  },
  resultBox: {
    gap: Spacing.two,
  },
  resultLabel: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  urlInput: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    padding: Spacing.three,
    color: NS.colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  secondaryAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: NS.radius.md,
    backgroundColor: NS.colors.bgCard,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
  },
  secondaryActionText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: NS.radius.md,
    backgroundColor: NS.colors.accent,
  },
  primaryActionText: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  resetAction: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  resetActionText: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  compactResult: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  compactUrl: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  compactActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  compactCopyButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: NS.radius.md,
    backgroundColor: NS.colors.bgCard,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
  },
  compactCopyText: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  compactShareButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: NS.radius.md,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  compactShareText: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
