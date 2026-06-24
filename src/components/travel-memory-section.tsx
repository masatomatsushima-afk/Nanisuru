import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  createTravelMemory,
  deleteTravelMemory,
  getTravelMemories,
  updateTravelMemory,
} from '@/lib/travel-memory';
import type { TravelMemory, TravelMemoryCategory } from '@/types/travel-memory';
import {
  getTravelMemoryCategoryIcon,
  getTravelMemoryCategoryLabel,
  TRAVEL_MEMORY_CATEGORIES,
} from '@/types/travel-memory';

type MemoryFormState = {
  id: string | null;
  category: TravelMemoryCategory;
  content: string;
};

type TravelMemorySectionProps = {
  isLoggedIn: boolean;
  isConfigured: boolean;
  onRequireLogin: () => void;
};

function MemoryRow({
  memory,
  onEdit,
  onDelete,
}: {
  memory: TravelMemory;
  onEdit: (memory: TravelMemory) => void;
  onDelete: (memory: TravelMemory) => void;
}) {
  return (
    <View style={styles.memoryRow}>
      <View style={styles.memoryMain}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeIcon}>
            {getTravelMemoryCategoryIcon(memory.category)}
          </Text>
          <Text style={styles.categoryBadgeText}>
            {getTravelMemoryCategoryLabel(memory.category)}
          </Text>
        </View>
        <Text style={styles.memoryContent}>{memory.content}</Text>
      </View>
      <View style={styles.memoryActions}>
        <Pressable style={styles.actionButton} onPress={() => onEdit(memory)}>
          <Text style={styles.actionButtonText}>編集</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => onDelete(memory)}>
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>削除</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MemoryEditorModal({
  visible,
  initial,
  isSaving,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: MemoryFormState;
  isSaving: boolean;
  onClose: () => void;
  onSave: (form: MemoryFormState) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);

  const handleOpen = useCallback(() => {
    setForm(initial);
  }, [initial]);

  const selectedCategory = TRAVEL_MEMORY_CATEGORIES.find((item) => item.value === form.category);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onShow={handleOpen}
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {form.id ? '旅行メモリーを編集' : '旅行メモリーを追加'}
          </Text>

          <Text style={styles.modalLabel}>カテゴリ</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryPicker}>
            {TRAVEL_MEMORY_CATEGORIES.map((item) => {
              const selected = form.category === item.value;
              return (
                <Pressable
                  key={item.value}
                  style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                  onPress={() => setForm((prev) => ({ ...prev, category: item.value }))}>
                  <Text style={styles.categoryChipIcon}>{item.icon}</Text>
                  <Text
                    style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.modalLabel}>内容</Text>
          <TextInput
            style={styles.modalInput}
            value={form.content}
            onChangeText={(content) => setForm((prev) => ({ ...prev, content }))}
            placeholder={selectedCategory?.placeholder ?? '好みを入力...'}
            placeholderTextColor={NS.colors.textMuted}
            multiline
            maxLength={200}
          />

          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancel} onPress={onClose} disabled={isSaving}>
              <Text style={styles.modalCancelText}>キャンセル</Text>
            </Pressable>
            <PrimaryButton
              label={isSaving ? '保存中...' : '保存'}
              onPress={() => onSave(form)}
              disabled={isSaving || !form.content.trim()}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const EMPTY_FORM: MemoryFormState = {
  id: null,
  category: 'food',
  content: '',
};

export function TravelMemorySection({
  isLoggedIn,
  isConfigured,
  onRequireLogin,
}: TravelMemorySectionProps) {
  const [memories, setMemories] = useState<TravelMemory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorForm, setEditorForm] = useState<MemoryFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    if (!isLoggedIn || !isConfigured) {
      setMemories([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setMemories(await getTravelMemories());
    } catch (err) {
      const message = err instanceof Error ? err.message : '旅行メモリーの取得に失敗しました';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, isLoggedIn]);

  useFocusEffect(
    useCallback(() => {
      loadMemories();
    }, [loadMemories]),
  );

  const openCreate = () => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }
    setEditorForm(EMPTY_FORM);
    setEditorVisible(true);
  };

  const openEdit = (memory: TravelMemory) => {
    setEditorForm({
      id: memory.id,
      category: memory.category,
      content: memory.content,
    });
    setEditorVisible(true);
  };

  const handleDelete = (memory: TravelMemory) => {
    Alert.alert('削除の確認', 'この旅行メモリーを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTravelMemory(memory.id);
            await loadMemories();
          } catch (err) {
            const message = err instanceof Error ? err.message : '削除に失敗しました';
            Alert.alert('エラー', message);
          }
        },
      },
    ]);
  };

  const handleSave = async (form: MemoryFormState) => {
    setIsSaving(true);
    try {
      if (form.id) {
        await updateTravelMemory(form.id, {
          category: form.category,
          content: form.content,
        });
      } else {
        await createTravelMemory({
          category: form.category,
          content: form.content,
        });
      }
      setEditorVisible(false);
      await loadMemories();
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存に失敗しました';
      Alert.alert('エラー', message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isConfigured) {
    return (
      <PremiumCard style={styles.card}>
        <Text style={styles.eyebrow}>TRAVEL MEMORY</Text>
        <Text style={styles.title}>旅行メモリー</Text>
        <Text style={styles.emptyText}>
          Supabase を設定すると、旅行の好みをクラウドに保存できます。
        </Text>
      </PremiumCard>
    );
  }

  if (!isLoggedIn) {
    return (
      <PremiumCard style={styles.card}>
        <Text style={styles.eyebrow}>TRAVEL MEMORY</Text>
        <Text style={styles.title}>旅行メモリー</Text>
        <Text style={styles.subtitle}>
          食の好みや旅行スタイルなどを保存。プラン生成時に自動で反映されます。
        </Text>
        <PrimaryButton label="ログインして使う" onPress={onRequireLogin} />
      </PremiumCard>
    );
  }

  return (
    <>
      <PremiumCard style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>TRAVEL MEMORY</Text>
            <Text style={styles.title}>旅行メモリー</Text>
            <Text style={styles.subtitle}>
              あなたの旅行の好みを保存。プラン生成時に自動で反映されます。
            </Text>
          </View>
          <Pressable style={styles.addButton} onPress={openCreate}>
            <Text style={styles.addButtonText}>＋ 追加</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isLoading ? (
          <Text style={styles.loadingText}>読み込み中...</Text>
        ) : memories.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              まだ旅行メモリーがありません。{'\n'}
              「＋ 追加」から食の好みや旅行スタイルなどを登録してください。
            </Text>
            <PrimaryButton label="最初のメモリーを追加" onPress={openCreate} />
          </View>
        ) : (
          <View style={styles.list}>
            {memories.map((memory) => (
              <MemoryRow
                key={memory.id}
                memory={memory}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </View>
        )}
      </PremiumCard>

      <MemoryEditorModal
        visible={editorVisible}
        initial={editorForm}
        isSaving={isSaving}
        onClose={() => setEditorVisible(false)}
        onSave={handleSave}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.one,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.one,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    lineHeight: 22,
  },
  addButton: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  addButtonText: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    gap: Spacing.three,
  },
  memoryRow: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.border,
    gap: Spacing.two,
  },
  memoryMain: {
    gap: Spacing.two,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  categoryBadgeIcon: {
    fontSize: 12,
  },
  categoryBadgeText: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  memoryContent: {
    color: NS.colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  memoryActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: NS.radius.sm,
    backgroundColor: NS.colors.bgCard,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
  },
  actionButtonText: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    borderColor: 'rgba(248, 113, 113, 0.3)',
    backgroundColor: NS.colors.dangerSoft,
  },
  deleteButtonText: {
    color: NS.colors.danger,
  },
  emptyBox: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  emptyText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    lineHeight: 22,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    marginTop: Spacing.two,
  },
  errorText: {
    color: NS.colors.danger,
    fontSize: 12,
    marginBottom: Spacing.two,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: NS.colors.overlay,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    gap: Spacing.three,
  },
  modalTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
  },
  modalLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  categoryPicker: {
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: NS.radius.pill,
    backgroundColor: NS.colors.bgCard,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
  },
  categoryChipSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  categoryChipIcon: {
    fontSize: 14,
  },
  categoryChipText: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryChipTextSelected: {
    color: NS.colors.accent,
  },
  modalInput: {
    minHeight: 96,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    padding: Spacing.three,
    color: NS.colors.text,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  modalCancel: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  modalCancelText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
