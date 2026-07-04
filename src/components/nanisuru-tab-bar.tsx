import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type TabMeta = {
  label: string;
  ios: string;
  android: string;
  web: string;
  fallback: string;
  activeColor: string;
};

const TAB_ITEMS: Record<string, TabMeta> = {
  index: {
    label: 'ホーム',
    ios: 'house.fill',
    android: 'home',
    web: 'home',
    fallback: '🏠',
    activeColor: '#FB923C',
  },
  favorites: {
    label: '保存',
    ios: 'bookmark',
    android: 'bookmark_border',
    web: 'bookmark_border',
    fallback: '📌',
    activeColor: '#64748B',
  },
  explore: {
    label: '発見',
    ios: 'safari',
    android: 'explore',
    web: 'explore',
    fallback: '🧭',
    activeColor: '#64748B',
  },
  ai: {
    label: '旅行秘書',
    ios: 'suitcase.fill',
    android: 'luggage',
    web: 'luggage',
    fallback: '🧳',
    activeColor: '#64748B',
  },
  profile: {
    label: 'マイページ',
    ios: 'person',
    android: 'person',
    web: 'person',
    fallback: '👤',
    activeColor: '#64748B',
  },
};

function TabIcon({ meta, focused }: { meta: TabMeta; focused: boolean }) {
  const tint = focused ? meta.activeColor : '#94A3B8';

  return (
    <SymbolView
      name={{ ios: meta.ios, android: meta.android, web: meta.web } as SymbolViewProps['name']}
      size={focused ? 20 : 19}
      tintColor={tint}
      fallback={<Text style={[styles.fallbackIcon, { color: tint }]}>{meta.fallback}</Text>}
    />
  );
}

export function NanisuruTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const meta = TAB_ITEMS[route.name] ?? {
            label: route.name,
            ios: 'circle',
            android: 'circle',
            web: 'circle',
            fallback: '•',
            activeColor: NS.colors.orange,
          };

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const activeColor = route.name === 'index' && isFocused ? '#FB923C' : isFocused ? '#475569' : '#94A3B8';

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={descriptors[route.key]?.options.title ?? meta.label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}>
              <TabIcon meta={meta} focused={isFocused} />
              <Text
                style={[
                  styles.label,
                  isFocused && { color: activeColor, fontWeight: '800' },
                ]}
                numberOfLines={1}>
                {meta.label}
              </Text>
              {isFocused ? (
                <View style={[styles.activeDot, { backgroundColor: activeColor }]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 4,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 20,
    gap: 2,
    minHeight: 46,
  },
  tabPressed: { opacity: 0.86 },
  fallbackIcon: { fontSize: 17, lineHeight: 19 },
  label: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
});
