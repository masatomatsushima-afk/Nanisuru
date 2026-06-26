import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { formatTripFolderLabel, type TripFolder } from '@/types/trip-folder';

type TripFolderSelectorProps = {
  folders: TripFolder[];
  selectedFolderId: string | null;
  onSelect: (folderId: string) => void;
  onCreateNew: () => void;
};

export function TripFolderSelector({
  folders,
  selectedFolderId,
  onSelect,
  onCreateNew,
}: TripFolderSelectorProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>相談する旅行を選ぶ</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {folders.map((folder) => {
          const active = folder.id === selectedFolderId;
          return (
            <Pressable
              key={folder.id}
              style={[styles.folderChip, active && styles.folderChipActive]}
              onPress={() => onSelect(folder.id)}>
              <Text style={styles.folderEmoji}>🧳</Text>
              <View style={styles.folderTextWrap}>
                <Text
                  style={[styles.folderTitle, active && styles.folderTitleActive]}
                  numberOfLines={1}>
                  {formatTripFolderLabel(folder)}
                </Text>
                <Text style={styles.folderMeta} numberOfLines={1}>
                  {folder.destination}
                  {folder.durationLabel ? ` · ${folder.durationLabel}` : ''}
                </Text>
              </View>
            </Pressable>
          );
        })}
        <Pressable style={styles.createChip} onPress={onCreateNew}>
          <Text style={styles.createEmoji}>＋</Text>
          <Text style={styles.createText}>新しい旅行を作る</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: NS.layout.screenPadding,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: NS.colors.border,
    backgroundColor: 'rgba(255,255,255,0.82)',
    gap: Spacing.two,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: NS.colors.accent,
    letterSpacing: 0.3,
  },
  scrollContent: {
    gap: Spacing.two,
    paddingRight: Spacing.two,
  },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: 220,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    ...NS.shadow.card,
  },
  folderChipActive: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  folderEmoji: {
    fontSize: 18,
  },
  folderTextWrap: {
    flexShrink: 1,
    gap: 2,
  },
  folderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: NS.colors.text,
  },
  folderTitleActive: {
    color: NS.colors.accent,
  },
  folderMeta: {
    fontSize: 11,
    color: NS.colors.textMuted,
  },
  createChip: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    backgroundColor: NS.colors.mintSoft,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.mint,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: 4,
  },
  createEmoji: {
    fontSize: 20,
    fontWeight: '800',
    color: NS.colors.mint,
  },
  createText: {
    fontSize: 11,
    fontWeight: '800',
    color: NS.colors.textSecondary,
    textAlign: 'center',
  },
});
