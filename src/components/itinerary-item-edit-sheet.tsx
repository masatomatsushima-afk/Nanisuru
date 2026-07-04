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
import type { ItineraryEditTarget, PartialItineraryEditResult } from '@/types/itinerary-edit';
import {
  ITINERARY_EDIT_FREE_TEXT_PLACEHOLDER,
  ITINERARY_SINGLE_EDIT_PRESETS,
  type ItinerarySingleEditPresetId,
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
}: {
  label: string;
  item?: { time: string; activity: string; activityCategory?: string; reason?: string } | null;
}) {
  if (!item) {
    return (
      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>{label}</Text>
        <Text style={styles.previewEmpty}>（なし）</Text>
      </View>
    );
  }

  return (
    <View style={styles.previewCard}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewTime}>{item.time}</Text>
      <Text style={styles.previewActivity}>{item.activity}</Text>
      {item.activityCategory ? (
        <Text style={styles.previewCategory}>{item.activityCategory}</Text>
      ) : null}
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

function buildEditRequest(
  presetId: ItinerarySingleEditPresetId,
  customText: string,
): string {
  const preset = ITINERARY_SINGLE_EDIT_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) return customText.trim();

  if (presetId === 'custom') {
    return customText.trim();
  }

  const extra = customText.trim();
  return extra ? `${preset.request} ${extra}` : preset.request;
}

export function ItineraryItemEditSheet({
  visible,
  target,
  payload,
  onClose,
  onApply,
}: ItineraryItemEditSheetProps) {
  const insets = useSafeAreaInsets();
  const [presetId, setPresetId] = useState<ItinerarySingleEditPresetId>('similar_vibe');
  const [customText, setCustomText] = useState('');
  const [preview, setPreview] = useState<PartialItineraryEditResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setPresetId('similar_vibe');
    setCustomText('');
    setPreview(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (visible && target) {
      console.log('[ItineraryEdit] selected item', {
        dayIndex: target.dayIndex,
        itemIndex: target.itemIndex,
        item: target.item,
      });
      resetState();
    }
  }, [visible, target, resetState]);

  const generatePreview = useCallback(async () => {
    if (!target) return;

    const editRequest = buildEditRequest(presetId, customText);
    if (!editRequest) {
      setError('変更内容を入力してください');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await previewPartialItineraryEdit({
        payload,
        target,
        action: 'change_place',
        userRequest: editRequest,
      });
      setPreview(result);
    } catch (err) {
      setError(getErrorMessage(err));
      setPreview(null);
    } finally {
      setIsGenerating(false);
    }
  }, [customText, payload, presetId, target]);

  const handleApply = async () => {
    if (!preview || !target) return;
    setIsApplying(true);
    setError(null);
    try {
      const editRequest = buildEditRequest(presetId, customText);
      await onApply(preview, editRequest);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsApplying(false);
    }
  };

  const handleDismissPreview = () => {
    setPreview(null);
    setError(null);
  };

  if (!target) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + Spacing.two }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.cancelLink}>キャンセル</Text>
          </Pressable>
          <Text style={styles.headerTitle}>この予定を変更</Text>
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

          {!preview ? (
            <>
              <Text style={styles.sectionTitle}>変更内容</Text>
              <View style={styles.optionsGrid}>
                {ITINERARY_SINGLE_EDIT_PRESETS.map((option) => (
                  <OptionChip
                    key={option.id}
                    label={option.label}
                    selected={presetId === option.id}
                    onPress={() => {
                      setPresetId(option.id);
                      setPreview(null);
                      setError(null);
                    }}
                  />
                ))}
              </View>

              {presetId === 'custom' || customText.length > 0 ? (
                <TextInput
                  style={[styles.textInput, styles.requestInput]}
                  value={customText}
                  onChangeText={(text) => {
                    setCustomText(text);
                    setPreview(null);
                  }}
                  placeholder={ITINERARY_EDIT_FREE_TEXT_PLACEHOLDER}
                  placeholderTextColor={NS.colors.textMuted}
                  multiline
                  textAlignVertical="top"
                />
              ) : null}

              <PrimaryButton
                label={isGenerating ? '変更案を作成中…' : '変更案を見る'}
                onPress={() => void generatePreview()}
                disabled={isGenerating || isApplying}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </>
          ) : (
            <View style={styles.previewSection}>
              <Text style={styles.sectionTitle}>変更案</Text>
              <Text style={styles.previewSummary}>{preview.preview.summary}</Text>

              <View style={styles.previewRow}>
                <PreviewCard label="変更前" item={preview.preview.beforeItem} />
                <Text style={styles.previewArrow}>→</Text>
                <PreviewCard label="変更後" item={preview.preview.afterItem} />
              </View>

              {preview.preview.reason ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>選定理由</Text>
                  <Text style={styles.detailText}>{preview.preview.reason}</Text>
                </View>
              ) : null}

              {preview.preview.movementFromPrev ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>前の予定からの移動</Text>
                  <Text style={styles.detailText}>{preview.preview.movementFromPrev}</Text>
                </View>
              ) : null}

              {preview.preview.movementToNext ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>次の予定への移動</Text>
                  <Text style={styles.detailText}>{preview.preview.movementToNext}</Text>
                </View>
              ) : null}

              {preview.preview.budgetImpact ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>予算への影響</Text>
                  <Text style={styles.detailText}>{preview.preview.budgetImpact}</Text>
                </View>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
                  onPress={handleDismissPreview}
                  disabled={isApplying}>
                  <Text style={styles.secondaryButtonText}>やっぱり戻す</Text>
                </Pressable>
              </View>
            </View>
          )}
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
  errorText: {
    color: NS.colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  previewSection: {
    gap: Spacing.three,
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
  detailBlock: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.sm,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.border,
    gap: 4,
  },
  detailLabel: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  detailText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  applyRow: {
    gap: Spacing.two,
    marginTop: Spacing.one,
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
