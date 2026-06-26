import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type AfterPlanLaunchButtonProps = {
  location?: string;
  baseTripId?: string;
  variant?: 'primary' | 'compact';
};

export function AfterPlanLaunchButton({
  location,
  baseTripId,
  variant = 'primary',
}: AfterPlanLaunchButtonProps) {
  const handlePress = () => {
    router.push({
      pathname: '/after-plan',
      params: {
        ...(location?.trim() ? { location: location.trim() } : {}),
        ...(baseTripId ? { baseTripId } : {}),
      },
    });
  };

  if (variant === 'compact') {
    return (
      <Pressable
        style={({ pressed }) => [styles.compactBtn, pressed && styles.pressed]}
        onPress={handlePress}>
        <Text style={styles.compactText}>🌙 この後のプランを作る</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
      onPress={handlePress}>
      <View style={styles.primaryInner}>
        <Text style={styles.primaryEmoji}>🌙</Text>
        <View style={styles.primaryTextWrap}>
          <Text style={styles.primaryTitle}>この後のプランを作る</Text>
          <Text style={styles.primarySubtitle}>2軒目・締め・夜景・カラオケまで提案</Text>
        </View>
        <Text style={styles.primaryArrow}>→</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    backgroundColor: NS.colors.purpleSoft,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
    overflow: 'hidden',
  },
  primaryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three + 2,
  },
  primaryEmoji: {
    fontSize: 28,
  },
  primaryTextWrap: {
    flex: 1,
    gap: 2,
  },
  primaryTitle: {
    color: NS.colors.purple,
    fontSize: 16,
    fontWeight: '800',
  },
  primarySubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  primaryArrow: {
    color: NS.colors.purple,
    fontSize: 18,
    fontWeight: '800',
  },
  compactBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: NS.radius.sm,
    backgroundColor: NS.colors.purpleSoft,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
  },
  compactText: {
    color: NS.colors.purple,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
});
