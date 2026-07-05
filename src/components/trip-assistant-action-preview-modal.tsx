import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { TripAssistantAction } from '@/types/trip-assistant';

type TripAssistantActionPreviewModalProps = {
  visible: boolean;
  action: TripAssistantAction | null;
  applying?: boolean;
  onClose: () => void;
  onApply: () => void;
};

function PreviewCard({
  label,
  item,
}: {
  label: string;
  item: { time: string; activity: string; activityCategory?: string };
}) {
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

export function TripAssistantActionPreviewModal({
  visible,
  action,
  applying = false,
  onClose,
  onApply,
}: TripAssistantActionPreviewModalProps) {
  const insets = useSafeAreaInsets();

  if (!action) return null;

  console.log('[TripAssistantAction] preview', {
    title: action.title,
    beforeItem: action.beforeItem.activity,
    afterItem: action.afterItem.activity,
    reason: action.reason,
    budgetImpact: action.budgetImpact,
    movementNote: action.movementNote,
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.three }]}>
          <Text style={styles.title}>プランに反映しますか？</Text>
          <Text style={styles.subtitle}>{action.title}</Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <PreviewCard label="変更前" item={action.beforeItem} />
            <Text style={styles.arrow}>↓</Text>
            <PreviewCard label="変更後" item={action.afterItem} />

            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>変更理由</Text>
              <Text style={styles.detailText}>{action.reason}</Text>
            </View>

            {action.budgetImpact ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>予算への影響</Text>
                <Text style={styles.detailText}>{action.budgetImpact}</Text>
              </View>
            ) : null}

            {action.movementNote ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>移動メモ</Text>
                <Text style={styles.detailText}>{action.movementNote}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <PrimaryButton
              label={applying ? '反映中…' : '反映する'}
              onPress={onApply}
              disabled={applying}
            />
            <Pressable style={styles.cancelButton} onPress={onClose} disabled={applying}>
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: NS.colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: NS.colors.bgElevated,
    borderTopLeftRadius: NS.radius.xxl,
    borderTopRightRadius: NS.radius.xxl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    maxHeight: '88%',
    gap: Spacing.three,
  },
  title: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  scroll: {
    maxHeight: 360,
  },
  previewCard: {
    backgroundColor: NS.colors.bgInput,
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
    color: NS.colors.textMuted,
    fontSize: 12,
  },
  arrow: {
    textAlign: 'center',
    color: NS.colors.textMuted,
    fontSize: 18,
    marginVertical: Spacing.one,
  },
  detailBlock: {
    marginTop: Spacing.three,
    backgroundColor: NS.colors.bgInput,
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
  actions: {
    gap: Spacing.two,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  cancelButtonText: {
    color: NS.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
