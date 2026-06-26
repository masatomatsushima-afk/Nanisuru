import { Pressable, StyleSheet, Text, View } from 'react-native';

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
    <View style={styles.wrap}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: NS.colors.border,
    marginBottom: Spacing.three,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: NS.colors.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
  tabTextActive: {
    color: NS.colors.accent,
  },
});
