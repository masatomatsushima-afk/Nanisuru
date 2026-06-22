import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type OAuthButtonsProps = {
  onGooglePress: () => void;
  onApplePress: () => void;
  isLoading?: boolean;
  loadingProvider?: 'google' | 'apple' | null;
};

export function OAuthButtons({
  onGooglePress,
  onApplePress,
  isLoading = false,
  loadingProvider = null,
}: OAuthButtonsProps) {
  const showApple = Platform.OS === 'ios' || Platform.OS === 'web';

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.googleButton,
          (isLoading || pressed) && styles.buttonPressed,
          isLoading && loadingProvider !== 'google' && styles.buttonDisabled,
        ]}
        onPress={onGooglePress}
        disabled={isLoading}>
        <Text style={styles.buttonIcon}>G</Text>
        <Text style={styles.buttonLabel}>
          {loadingProvider === 'google' ? 'Googleで接続中...' : 'Googleで続ける'}
        </Text>
      </Pressable>

      {showApple ? (
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.appleButton,
            (isLoading || pressed) && styles.buttonPressed,
            isLoading && loadingProvider !== 'apple' && styles.buttonDisabled,
          ]}
          onPress={onApplePress}
          disabled={isLoading}>
          <Text style={[styles.buttonIcon, styles.appleIcon]}>{'\uF8FF'}</Text>
          <Text style={[styles.buttonLabel, styles.appleLabel]}>
            {loadingProvider === 'apple' ? 'Appleで接続中...' : 'Appleで続ける'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: NS.radius.md + 2,
    paddingVertical: 16,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
  },
  googleButton: {
    backgroundColor: NS.colors.bgCard,
    borderColor: NS.colors.borderStrong,
  },
  appleButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: NS.colors.text,
    width: 22,
    textAlign: 'center',
  },
  appleIcon: {
    color: '#000000',
    fontSize: 20,
  },
  buttonLabel: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  appleLabel: {
    color: '#000000',
  },
});
