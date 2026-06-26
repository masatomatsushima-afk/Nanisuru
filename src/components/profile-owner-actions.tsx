import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type ProfileOwnerActionsProps = {
  onEditProfile: () => void;
  onEditPreferences: () => void;
  onPrivacySettings: () => void;
};

const ACTIONS = [
  { id: 'profile', label: 'プロフィールを編集', color: NS.colors.coral, bg: NS.colors.coralSoft },
  { id: 'prefs', label: '好みを編集', color: NS.colors.sky, bg: NS.colors.skySoft },
  { id: 'privacy', label: '公開設定', color: NS.colors.mint, bg: NS.colors.mintSoft },
] as const;

export function ProfileOwnerActions({
  onEditProfile,
  onEditPreferences,
  onPrivacySettings,
}: ProfileOwnerActionsProps) {
  const handlers = {
    profile: onEditProfile,
    prefs: onEditPreferences,
    privacy: onPrivacySettings,
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}>
      {ACTIONS.map((action) => (
        <Pressable
          key={action.id}
          style={({ pressed }) => [
            styles.chip,
            { backgroundColor: action.bg, borderColor: action.color },
            pressed && styles.chipPressed,
          ]}
          onPress={handlers[action.id]}>
          <Text style={[styles.chipText, { color: action.color }]}>{action.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  chip: {
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
