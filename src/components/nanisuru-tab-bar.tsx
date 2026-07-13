import { memo, useCallback, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { safeText } from '@/lib/safe-text';

type TabMeta = {
  label: string;
  icon: string;
  activeColor: string;
  activeSoft: string;
};

const DEFAULT_TAB_META: TabMeta = {
  label: 'タブ',
  icon: '•',
  activeColor: NS.colors.tabActive,
  activeSoft: NS.colors.tabActiveSoft,
};

/** Plain-string route keys only — never derive labels from Symbol or component values. */
const TAB_ITEMS: Record<string, TabMeta> = {
  index: {
    label: 'ホーム',
    icon: '🏠',
    activeColor: NS.colors.orange,
    activeSoft: NS.colors.orangeSoft,
  },
  explore: {
    label: '発見',
    icon: '✨',
    activeColor: NS.colors.tabActive,
    activeSoft: NS.colors.tabActiveSoft,
  },
  favorites: {
    label: '保存済み',
    icon: '📌',
    activeColor: NS.colors.coral,
    activeSoft: NS.colors.coralSoft,
  },
  ai: {
    label: '旅行秘書',
    icon: '🧳',
    activeColor: NS.colors.sky,
    activeSoft: NS.colors.skySoft,
  },
  profile: {
    label: 'マイページ',
    icon: '👤',
    activeColor: NS.colors.purple,
    activeSoft: NS.colors.purpleSoft,
  },
};

function resolveTabMeta(routeName: unknown): TabMeta {
  const key = safeText(routeName);
  return TAB_ITEMS[key] ?? DEFAULT_TAB_META;
}

function resolveAccessibilityLabel(
  descriptorTitle: unknown,
  meta: TabMeta,
): string {
  const fromOptions = safeText(descriptorTitle);
  return fromOptions || meta.label;
}

function TabIcon({ meta, focused }: { meta: TabMeta; focused: boolean }) {
  const tint = focused ? meta.activeColor : NS.colors.textMuted;

  return (
    <Text style={[styles.icon, { color: tint }]} accessibilityElementsHidden importantForAccessibility="no">
      {meta.icon}
    </Text>
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
  const activeColor = isFocused ? meta.activeColor : NS.colors.textMuted;

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
      {isFocused ? (
        <View style={[styles.activePill, { backgroundColor: meta.activeSoft }]} />
      ) : null}
      <TabIcon meta={meta} focused={isFocused} />
      <Text
        style={[styles.label, isFocused && { color: activeColor, fontWeight: '800' }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}>
        {meta.label}
      </Text>
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
          const meta = resolveTabMeta(route.name);
          const descriptor = descriptors[route.key];

          return (
            <TabBarButton
              key={route.key}
              route={route}
              isFocused={isFocused}
              meta={meta}
              accessibilityLabel={resolveAccessibilityLabel(descriptor?.options.title, meta)}
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
    pointerEvents: 'box-none',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    backgroundColor: NS.colors.navBg,
    borderRadius: 28,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: NS.colors.navBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
      default: {
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
      },
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 1,
    borderRadius: 20,
    gap: 2,
    minHeight: 48,
    position: 'relative',
  },
  tabPressed: { opacity: 0.88 },
  activePill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
    marginHorizontal: 1,
    marginVertical: 2,
  },
  icon: {
    fontSize: 18,
    lineHeight: 20,
  },
  label: {
    color: NS.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.3,
    maxWidth: '100%',
    textAlign: 'center',
  },
});
