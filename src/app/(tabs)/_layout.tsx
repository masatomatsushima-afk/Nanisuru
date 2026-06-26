import { Tabs } from 'expo-router';

import { NanisuruTabBar } from '@/components/nanisuru-tab-bar';
import { NS } from '@/constants/nanisuru-ui';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <NanisuruTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'ホーム' }} />
      <Tabs.Screen name="favorites" options={{ title: '保存済み' }} />
      <Tabs.Screen name="explore" options={{ title: '発見' }} />
      <Tabs.Screen name="ai" options={{ title: '旅行秘書' }} />
      <Tabs.Screen name="profile" options={{ title: 'マイページ' }} />
    </Tabs>
  );
}
