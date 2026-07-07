import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type TabMeta = {
  label: string;
  symbolName: SymbolViewProps['name'];
  fallback: string;
  activeColor: string;
};

const DEFAULT_TAB_META: TabMeta = {
  label: 'タブ',
  symbolName: { ios: 'circle', android: 'circle', web: 'circle' },
  fallback: '•',
  activeColor: NS.colors.orange,
};

const TAB_ITEMS: Record<string, TabMeta> = {
  index: {
    label: 'ホーム',
    symbolName: { ios: 'house.fill', android: 'home', web: 'home' },
    fallback: '🏠',
    activeColor: '#FB923C',
  },
  favorites: {
    label: '保存',
    symbolName: { ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' },
    fallback: '📌',
    activeColor: '#64748B',
  },
  explore: {
    label: '発見',
    symbolName: { ios: 'safari', android: 'explore', web: 'explore' },
    fallback: '🧭',
    activeColor: '#64748B',
  },
  ai: {
    label: '旅行秘書',
    symbolName: { ios: 'suitcase.fill', android: 'luggage', web: 'luggage' },
    fallback: '🧳',
    activeColor: '#64748B',
  },
  profile: {
    label: 'マイページ',
    symbolName: { ios: 'person', android: 'person', web: 'person' },
    fallback: '👤',
    activeColor: '#64748B',
  },
};

function TabIcon({ meta, focused }: { meta: TabMeta; focused: boolean }) {
  const tint = focused ? meta.activeColor : '#94A3B8';

  return (
    <SymbolView
      name={meta.symbolName}
      size={focused ? 20 : 19}
      tintColor={tint}
      fallback={<Text style={[styles.fallbackIcon, { color: tint }]}>{meta.fallback}</Text>}
    />
  );
}

type TabBarButtonProps = {
  route: BottomTabBarProps['state']['routes'][number];
  isFocused: boolean;
  meta: TabMeta;
  accessibilityLabel: string;
  navigation: BottomTabBarProps['navigation'];
};

const TabBarButton = memo(function TabBarButton({
  route,
  isFocused,
  meta,
  accessibilityLabel,
  navigation,
}: TabBarButtonProps) {
  const activeColor =
    route.name === 'index' && isFocused ? '#FB923C' : isFocused ? '#475569' : '#94A3B8';

  const onPress = useCallback(() => {
    if (isFocused) return;

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (event.defaultPrevented) return;
    navigation.navigate(route.name, route.params);
  }, [isFocused, navigation, route.key, route.name, route.params]);

  const onLongPress = useCallback(() => {
    navigation.emit({
      type: 'tabLongPress',
      target: route.key,
    });
  }, [navigation, route.key]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}>
      <TabIcon meta={meta} focused={isFocused} />
      <Text
        style={[styles.label, isFocused && { color: activeColor, fontWeight: '800' }]}
        numberOfLines={1}>
        {meta.label}
      </Text>
      {isFocused ? <View style={[styles.activeDot, { backgroundColor: activeColor }]} /> : null}
    </Pressable>
  );
});

export const NanisuruTabBar = memo(function NanisuruTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = useMemo(
    () => Math.max(insets.bottom, Spacing.two),
    [insets.bottom],
  );

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPadding }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const meta = TAB_ITEMS[route.name] ?? DEFAULT_TAB_META;

          return (
            <TabBarButton
              key={route.key}
              route={route}
              isFocused={isFocused}
              meta={meta}
              accessibilityLabel={descriptors[route.key]?.options.title ?? meta.label}
              navigation={navigation}
            />
          );
        })}
      </View>
    </View>
  );
});

/** Stable tabBar render prop — do not inline in Tabs layout (causes BottomTabView update loops). */
export function renderNanisuruTabBar(props: BottomTabBarProps) {
  return <NanisuruTabBar {...props} />;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: NS.layout.screenPadding,
    paddingTop: Spacing.two,
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
