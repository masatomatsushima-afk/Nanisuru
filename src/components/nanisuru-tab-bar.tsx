import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

const TAB_ITEMS: Record<
  string,
  { label: string; emoji: string; activeColor: string }
> = {
  index: { label: 'ホーム', emoji: '🏠', activeColor: NS.colors.orange },
  favorites: { label: '保存', emoji: '📌', activeColor: '#0284C7' },
  explore: { label: '発見', emoji: '✨', activeColor: '#7C3AED' },
  ai: { label: '旅行秘書', emoji: '🧳', activeColor: '#059669' },
  profile: { label: 'マイページ', emoji: '👤', activeColor: '#E11D48' },
};

export function NanisuruTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const meta = TAB_ITEMS[route.name] ?? {
            label: route.name,
            emoji: '•',
            activeColor: NS.colors.accent,
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
                isFocused && route.name === 'index' && styles.tabActiveHome,
                isFocused && route.name !== 'index' && styles.tabActiveOther,
                pressed && styles.tabPressed,
              ]}>
              <Text style={[styles.emoji, isFocused && { opacity: 1 }]}>{meta.emoji}</Text>
              <Text
                style={[
                  styles.label,
                  isFocused && { color: meta.activeColor, fontWeight: '800' },
                ]}
                numberOfLines={1}>
                {meta.label}
              </Text>
              {isFocused ? (
                <View style={[styles.activeDot, { backgroundColor: meta.activeColor }]} />
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
    paddingHorizontal: Spacing.two + 4,
    paddingTop: 4,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 28,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.05)',
    ...NS.shadow.nav,
    shadowOpacity: 0.1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 20,
    gap: 1,
    minHeight: 48,
  },
  tabActiveHome: {
    backgroundColor: 'rgba(251, 146, 60, 0.1)',
  },
  tabActiveOther: {
    backgroundColor: 'rgba(15, 23, 42, 0.03)',
  },
  tabPressed: {
    opacity: 0.88,
  },
  emoji: {
    fontSize: 16,
    lineHeight: 18,
    opacity: 0.72,
  },
  label: {
    color: NS.colors.textMuted,
    fontSize: 9,
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
