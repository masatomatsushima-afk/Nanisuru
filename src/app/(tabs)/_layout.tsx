import { Tabs } from 'expo-router';

import { renderNanisuruTabBar } from '@/components/nanisuru-tab-bar';
import { LOOP_TEST_RESTORE, loopTestLogOnce } from '@/lib/loop-test-config';

const TAB_SCREEN_OPTIONS = {
  headerShown: false,
  tabBarHideOnKeyboard: true,
} as const;

const TAB_INDEX_OPTIONS = { title: 'ホーム', tabBarLabel: 'ホーム' } as const;
const TAB_FAVORITES_OPTIONS = { title: '保存済み', tabBarLabel: '保存済み' } as const;
const TAB_EXPLORE_OPTIONS = { title: '発見', tabBarLabel: '発見' } as const;
const TAB_AI_OPTIONS = { title: '旅行秘書', tabBarLabel: '旅行秘書' } as const;
const TAB_PROFILE_OPTIONS = { title: 'マイページ', tabBarLabel: 'マイページ' } as const;

export default function TabsLayout() {
  if (LOOP_TEST_RESTORE.customTabBar) {
    loopTestLogOnce('restore:customTabBar', 'restoring custom bottom nav');
  }

  return (
    <Tabs
      screenOptions={TAB_SCREEN_OPTIONS}
      tabBar={LOOP_TEST_RESTORE.customTabBar ? renderNanisuruTabBar : undefined}>
      <Tabs.Screen name="index" options={TAB_INDEX_OPTIONS} />
      <Tabs.Screen name="favorites" options={TAB_FAVORITES_OPTIONS} />
      <Tabs.Screen name="explore" options={TAB_EXPLORE_OPTIONS} />
      <Tabs.Screen name="ai" options={TAB_AI_OPTIONS} />
      <Tabs.Screen name="profile" options={TAB_PROFILE_OPTIONS} />
    </Tabs>
  );
}
