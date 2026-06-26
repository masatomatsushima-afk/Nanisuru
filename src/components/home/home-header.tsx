import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NS } from '@/constants/nanisuru-ui';
import { useAuth } from '@/contexts/auth-context';
import { getUserInitial } from '@/lib/auth';

export function HomeHeader() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 4 }]}>
      <View style={styles.brand}>
        <Text style={styles.logo}>Nanisuru</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          onPress={() => router.push('/(tabs)/explore')}
          accessibilityLabel="検索">
          <Text style={styles.icon}>🔍</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.avatarBtn, pressed && styles.pressed]}
          onPress={() => router.push('/(tabs)/profile')}
          accessibilityLabel="マイページ">
          <Text style={styles.avatarText}>{user ? getUserInitial(user) : '👤'}</Text>
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
    paddingBottom: 2,
  },
  brand: {
    justifyContent: 'center',
  },
  logo: {
    color: NS.colors.orange,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NS.colors.coralSoft,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pressed: {
    opacity: 0.85,
  },
  icon: {
    fontSize: 15,
  },
  avatarText: {
    color: NS.colors.coral,
    fontSize: 13,
    fontWeight: '900',
  },
});
