import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type DiscoverHeaderProps = {
  onSearchPress: () => void;
  onFilterPress: () => void;
  filterActive?: boolean;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
};

export function DiscoverHeader({
  onSearchPress,
  onFilterPress,
  filterActive = false,
  isLoggedIn = false,
  onRequireLogin,
}: DiscoverHeaderProps) {
  const insets = useSafeAreaInsets();

  const handlePost = () => {
    if (!isLoggedIn) {
      onRequireLogin?.();
      return;
    }
    router.push('/(tabs)');
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.leading}>
        <Text style={styles.title}>発見</Text>
        <Text style={styles.subtitle}>今日のインスピレーション</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
          onPress={onSearchPress}
          accessibilityLabel="検索">
          <Text style={styles.icon}>🔍</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.iconBtn,
            filterActive && styles.iconBtnActive,
            pressed && styles.iconBtnPressed,
          ]}
          onPress={onFilterPress}
          accessibilityLabel="フィルター">
          <Text style={styles.icon}>🎛</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.postBtn, pressed && styles.postBtnPressed]}
          onPress={handlePost}>
          <Text style={styles.postText}>投稿</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.two,
  },
  leading: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: NS.colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    ...NS.shadow.card,
    shadowOpacity: 0.06,
  },
  iconBtnActive: {
    backgroundColor: NS.colors.accentSoft,
  },
  iconBtnPressed: {
    opacity: 0.85,
  },
  icon: {
    fontSize: 16,
  },
  postBtn: {
    backgroundColor: NS.colors.coral,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 3,
    ...NS.shadow.card,
    shadowOpacity: 0.12,
  },
  postBtnPressed: {
    opacity: 0.9,
  },
  postText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
});
