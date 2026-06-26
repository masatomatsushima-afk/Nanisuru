import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { PROFILE_TABS, type ProfileTabId } from '@/types/profile-portfolio';

type ProfileTabBarProps = {
  activeTab: ProfileTabId;
  isSelf: boolean;
  onChange: (tab: ProfileTabId) => void;
};

export function ProfileTabBar({ activeTab, isSelf, onChange }: ProfileTabBarProps) {
  const tabs = PROFILE_TABS.filter((tab) => isSelf || !tab.ownerOnly);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      style={styles.wrap}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(tab.id)}>
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.three,
    flexGrow: 0,
  },
  scroll: {
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  tab: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  tabActive: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '800',
    color: NS.colors.textMuted,
  },
  tabTextActive: {
    color: NS.colors.accent,
  },
});
