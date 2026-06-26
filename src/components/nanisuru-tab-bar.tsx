import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';

import { NS, gradientStyle } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

const TAB_ITEMS: Record<
  string,
  { label: string; emoji: string; activeBg: string; activeText: string }
> = {
  index: { label: 'ホーム', emoji: '🏠', activeBg: NS.colors.tabActiveSoft, activeText: NS.colors.tabActive },
  favorites: { label: '保存済み', emoji: '📌', activeBg: NS.colors.coralSoft, activeText: NS.colors.coral },
  explore: { label: '発見', emoji: '✨', activeBg: NS.colors.purpleSoft, activeText: '#7C3AED' },
  ai: { label: '旅行秘書', emoji: '🧳', activeBg: NS.colors.mintSoft, activeText: '#059669' },
  profile: { label: 'マイページ', emoji: '👤', activeBg: NS.colors.orangeSoft, activeText: NS.colors.orange },
};

export function NanisuruTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
      <View style={[styles.bar, gradientStyle('navBar')]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const meta = TAB_ITEMS[route.name] ?? {
            label: route.name,
            emoji: '•',
            activeBg: NS.colors.accentSoft,
            activeText: NS.colors.accent,
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

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={descriptors[route.key]?.options.title ?? meta.label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [
                styles.tab,
                isFocused && { backgroundColor: meta.activeBg },
                pressed && styles.tabPressed,
              ]}>
              <Text style={styles.emoji}>{meta.emoji}</Text>
              <Text
                style={[
                  styles.label,
                  isFocused && { color: meta.activeText, fontWeight: '800' },
                ]}
                numberOfLines={1}>
                {meta.label}
              </Text>
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
    paddingHorizontal: Spacing.two,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: NS.colors.navBg,
    borderRadius: NS.radius.xxl,
    borderWidth: 1,
    borderColor: NS.colors.navBorder,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
    ...NS.shadow.nav,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: 4,
    borderRadius: NS.radius.lg,
    gap: 2,
    minHeight: 56,
  },
  tabPressed: {
    opacity: 0.88,
  },
  emoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  label: {
    color: NS.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
