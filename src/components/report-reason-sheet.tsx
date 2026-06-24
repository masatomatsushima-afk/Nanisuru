import { useState } from 'react';
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

import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type ReportReason = {
  id: string;
  label: string;
};

type ReportReasonSheetProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  reasons: readonly ReportReason[];
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => Promise<void>;
};

export function ReportReasonSheet({
  visible,
  title,
  subtitle,
  reasons,
  submitLabel = '通報する',
  onClose,
  onSubmit,
}: ReportReasonSheetProps) {
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setSelectedReason(null);
    setDetails('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError('理由を選択してください');
      return;
    }

    const reasonLabel = reasons.find((item) => item.id === selectedReason)?.label ?? selectedReason;
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(reasonLabel, details);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { paddingTop: insets.top + Spacing.three }]}>
        <View style={styles.header}>
          <Pressable onPress={handleClose}>
            <Text style={styles.closeText}>キャンセル</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + Spacing.six },
          ]}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={styles.note}>
            通報内容は安全のため確認されます。虚偽の通報は利用規約に反する場合があります。
          </Text>

          <View style={styles.reasonList}>
            {reasons.map((reason) => {
              const selected = selectedReason === reason.id;
              return (
                <Pressable
                  key={reason.id}
                  style={({ pressed }) => [
                    styles.reasonItem,
                    selected && styles.reasonItemSelected,
                    pressed && styles.reasonItemPressed,
                  ]}
                  onPress={() => setSelectedReason(reason.id)}>
                  <Text style={[styles.reasonLabel, selected && styles.reasonLabelSelected]}>
                    {reason.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {selectedReason === 'other' ? (
            <TextInput
              style={styles.detailsInput}
              value={details}
              onChangeText={setDetails}
              placeholder="詳細があれば入力してください（任意）"
              placeholderTextColor={NS.colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PrimaryButton
            label={isSubmitting ? '送信中...' : submitLabel}
            onPress={() => void handleSubmit()}
            disabled={isSubmitting || !selectedReason}
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
  closeText: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    minWidth: 80,
  },
  headerTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  headerSpacer: {
    minWidth: 80,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  subtitle: {
    color: NS.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  note: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  reasonList: {
    gap: Spacing.two,
  },
  reasonItem: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  reasonItemSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  reasonItemPressed: {
    opacity: 0.9,
  },
  reasonLabel: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  reasonLabelSelected: {
    color: NS.colors.text,
    fontWeight: '800',
  },
  detailsInput: {
    minHeight: 96,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.four,
    color: NS.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: NS.colors.danger,
    fontSize: 13,
    lineHeight: 20,
  },
});
