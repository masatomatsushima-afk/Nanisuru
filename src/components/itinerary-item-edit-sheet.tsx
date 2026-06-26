import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/app-errors';
import { previewPartialItineraryEdit } from '@/lib/itinerary-partial-edit';
import type {
  ItineraryEditAction,
  ItineraryEditTarget,
  PartialItineraryEditResult,
} from '@/types/itinerary-edit';
import {
  ITINERARY_EDIT_ACTIONS,
  ITINERARY_EDIT_QUICK_CHIPS,
} from '@/types/itinerary-edit';
import type { SavedTripPayload } from '@/types/trip';

type ItineraryItemEditSheetProps = {
  visible: boolean;
  target: ItineraryEditTarget | null;
  payload: SavedTripPayload;
  onClose: () => void;
  onApply: (result: PartialItineraryEditResult, editRequest: string) => Promise<void>;
};

function PreviewCard({
  label,
  item,
  time,
  activity,
}: {
  label: string;
  item?: { time: string; activity: string; activityCategory?: string; reason?: string } | null;
  time?: string;
  activity?: string;
}) {
  const displayTime = item?.time ?? time ?? '';
  const displayActivity = item?.activity ?? activity ?? '';

  return (
    <View style={styles.previewCard}>
      <Text style={styles.previewLabel}>{label}</Text>
      {displayActivity ? (
        <>
          <Text style={styles.previewTime}>{displayTime}</Text>
          <Text style={styles.previewActivity}>{displayActivity}</Text>
          {item?.activityCategory ? (
            <Text style={styles.previewCategory}>{item.activityCategory}</Text>
          ) : null}
          {item?.reason ? <Text style={styles.previewReason}>{item.reason}</Text> : null}
        </>
      ) : (
        <Text style={styles.previewEmpty}>（削除）</Text>
      )}
    </View>
  );
}

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
        styles.optionChip,
        selected && styles.optionChipSelected,
        pressed && styles.optionChipPressed,
      ]}
      onPress={onPress}>
      <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function ItineraryItemEditSheet({
  visible,
  target,
  payload,
  onClose,
  onApply,
}: ItineraryItemEditSheetProps) {
  const insets = useSafeAreaInsets();
  const [action, setAction] = useState<ItineraryEditAction>('ai_consult');
  const [userRequest, setUserRequest] = useState('');
  const [newTime, setNewTime] = useState('');
  const [preview, setPreview] = useState<PartialItineraryEditResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variationSeed, setVariationSeed] = useState(0);

  const resetState = useCallback(() => {
    setAction('ai_consult');
    setUserRequest('');
    setNewTime(target?.item.time ?? '');
    setPreview(null);
    setError(null);
    setVariationSeed(0);
  }, [target?.item.time]);

  useEffect(() => {
    if (visible && target) {
      resetState();
    }
  }, [visible, target, resetState]);

  const generatePreview = useCallback(
    async (options?: { variation?: boolean }) => {
      if (!target) return;

      setIsGenerating(true);
      setError(null);

      const seed = options?.variation ? variationSeed + 1 : variationSeed;
      if (options?.variation) setVariationSeed(seed);

      try {
        const result = await previewPartialItineraryEdit({
          payload,
          target,
          action,
          userRequest: userRequest.trim() || getDefaultRequest(action, target),
          newTime: action === 'change_time' ? newTime : undefined,
          reorderDirection: action === 'reorder' ? 'down' : undefined,
          variationSeed: options?.variation ? seed : undefined,
        });
        setPreview(result);
      } catch (err) {
        setError(getErrorMessage(err));
        setPreview(null);
      } finally {
        setIsGenerating(false);
      }
    },
    [action, newTime, payload, target, userRequest, variationSeed],
  );

  const handleApply = async () => {
    if (!preview) return;
    setIsApplying(true);
    setError(null);
    try {
      await onApply(preview, userRequest.trim() || getDefaultRequest(action, target!));
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsApplying(false);
    }
  };

  if (!target) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + Spacing.two }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.cancelLink}>キャンセル</Text>
          </Pressable>
          <Text style={styles.headerTitle}>ここを変更</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.six }]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.targetBox}>
            <Text style={styles.targetLabel}>変更対象</Text>
            <Text style={styles.targetTime}>{target.item.time}</Text>
            <Text style={styles.targetActivity}>{target.item.activity}</Text>
          </View>

          <Text style={styles.sectionTitle}>変更内容</Text>
          <View style={styles.optionsGrid}>
            {ITINERARY_EDIT_ACTIONS.map((option) => (
              <OptionChip
                key={option.id}
                label={option.label}
                selected={action === option.id}
                onPress={() => {
                  setAction(option.id);
                  setPreview(null);
                }}
              />
            ))}
          </View>

          {action === 'change_time' ? (
            <View style={styles.timeInputBox}>
              <Text style={styles.inputLabel}>新しい時間（HH:MM）</Text>
              <TextInput
                style={styles.textInput}
                value={newTime}
                onChangeText={setNewTime}
                placeholder="例: 14:30"
                placeholderTextColor={NS.colors.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          ) : null}

          {action !== 'delete' && action !== 'reorder' ? (
            <>
              <Text style={styles.sectionTitle}>どう変えたいですか？</Text>
              <TextInput
                style={[styles.textInput, styles.requestInput]}
                value={userRequest}
                onChangeText={setUserRequest}
                placeholder="例：ここはカフェにしたい、ビーチに寄ってから行きたい、もっと近い場所がいい"
                placeholderTextColor={NS.colors.textMuted}
                multiline
                textAlignVertical="top"
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {ITINERARY_EDIT_QUICK_CHIPS.map((chip) => (
                  <Pressable
                    key={chip}
                    style={({ pressed }) => [styles.quickChip, pressed && styles.quickChipPressed]}
                    onPress={() => {
                      setUserRequest(chip);
                      setPreview(null);
                    }}>
                    <Text style={styles.quickChipText}>{chip}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          <PrimaryButton
            label={preview ? 'プレビューを更新' : '変更案を見る'}
            onPress={() => void generatePreview()}
            disabled={isGenerating || isApplying}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {preview ? (
            <View style={styles.previewSection}>
              <Text style={styles.sectionTitle}>変更プレビュー</Text>
              <Text style={styles.previewSummary}>{preview.preview.summary}</Text>
              <View style={styles.previewRow}>
                <PreviewCard label="変更前" item={preview.preview.beforeItem} />
                <Text style={styles.previewArrow}>→</Text>
                <PreviewCard label="変更後" item={preview.preview.afterItem} />
              </View>

              <View style={styles.applyRow}>
                {isApplying ? (
                  <View style={styles.applyingRow}>
                    <ActivityIndicator size="small" color={NS.colors.accent} />
                    <Text style={styles.applyingText}>反映中...</Text>
                  </View>
                ) : (
                  <PrimaryButton
                    label="この変更を反映"
                    onPress={() => void handleApply()}
                    disabled={isGenerating}
                  />
                )}
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                  onPress={() => void generatePreview({ variation: true })}
                  disabled={isGenerating || isApplying}>
                  <Text style={styles.secondaryButtonText}>別案を見る</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function getDefaultRequest(action: ItineraryEditAction, target: ItineraryEditTarget): string {
  const name = target.item.activity;
  switch (action) {
    case 'change_place':
      return `${name}を別の場所に変更したい`;
    case 'add_before':
      return `${name}の前に予定を追加したい`;
    case 'add_after':
      return `${name}の後に予定を追加したい`;
    case 'delete':
      return `${name}を削除したい`;
    case 'change_time':
      return `${name}の時間を変更したい`;
    case 'reorder':
      return `${name}の順番を変更したい`;
    default:
      return `${name}を変更したい`;
  }
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
  cancelLink: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    color: NS.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 56,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  targetBox: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  targetLabel: {
    color: NS.colors.accent,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  targetTime: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  targetActivity: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionTitle: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  optionChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    backgroundColor: NS.colors.bgCard,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  optionChipSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  optionChipPressed: {
    opacity: 0.85,
  },
  optionChipText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  optionChipTextSelected: {
    color: NS.colors.accent,
    fontWeight: '700',
  },
  inputLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.one,
  },
  textInput: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.sm,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    color: NS.colors.text,
    fontSize: 15,
  },
  requestInput: {
    minHeight: 88,
  },
  timeInputBox: {
    gap: Spacing.one,
  },
  chipsScroll: {
    marginHorizontal: -Spacing.one,
  },
  quickChip: {
    marginHorizontal: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    backgroundColor: NS.colors.bgElevated,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  quickChipPressed: {
    opacity: 0.85,
  },
  quickChipText: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  previewButton: {
    marginTop: Spacing.one,
  },
  errorText: {
    color: NS.colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  previewSection: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  previewSummary: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.two,
  },
  previewCard: {
    flex: 1,
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.border,
    gap: 4,
  },
  previewLabel: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  previewTime: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  previewActivity: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  previewCategory: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  previewReason: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  previewEmpty: {
    color: NS.colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  previewArrow: {
    alignSelf: 'center',
    color: NS.colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
  applyRow: {
    gap: Spacing.two,
  },
  applyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  applyingText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    backgroundColor: NS.colors.bgCard,
  },
  secondaryButtonPressed: {
    opacity: 0.85,
  },
  secondaryButtonText: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
