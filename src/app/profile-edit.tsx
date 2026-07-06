import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RequireAuthGate } from '@/components/require-auth-gate';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { ScreenBackground } from '@/components/ui/screen-background';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { toAuthErrorMessage } from '@/lib/auth-errors';
import { ensureUserProfile, saveUserProfile } from '@/lib/user-profiles';
import { getProfileInitial } from '@/types/user-profile';

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const { isLoggedIn, isConfigured } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!isLoggedIn || !isConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const profile = await ensureUserProfile();
      setDisplayName(profile.displayName);
      setBio(profile.bio);
    } catch {
      Alert.alert('エラー', '通信に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, isLoggedIn]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('入力エラー', '表示名を入力してください');
      return;
    }

    setIsSaving(true);
    try {
      await saveUserProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        styleTags: [],
      });
      Alert.alert('保存しました', 'プロフィールを更新しました', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('エラー', toAuthErrorMessage(error, '通信に失敗しました'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RequireAuthGate
      title="プロフィール編集にはログインが必要です"
      description="ログインすると、表示名や自己紹介を保存できます。">
      <ScreenBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[
              styles.content,
              {
                paddingTop: insets.top + Spacing.four,
                paddingBottom: insets.bottom + Spacing.five,
              },
            ]}
            keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>プロフィール編集</Text>

            {isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={NS.colors.accent} />
              </View>
            ) : (
              <PremiumCard style={styles.card}>
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{getProfileInitial(displayName || '?')}</Text>
                </View>
                <Text style={styles.avatarHint}>アイコン画像（準備中）</Text>

                <Text style={styles.label}>表示名</Text>
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="表示名"
                  placeholderTextColor={NS.colors.textMuted}
                />

                <Text style={styles.label}>自己紹介</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="自己紹介を入力"
                  placeholderTextColor={NS.colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <PrimaryButton
                  label={isSaving ? '保存中…' : '保存する'}
                  onPress={() => void handleSave()}
                  disabled={isSaving}
                />
              </PremiumCard>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenBackground>
    </RequireAuthGate>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: NS.layout.screenPadding,
    maxWidth: NS.layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  title: {
    color: NS.colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  loadingWrap: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  card: {
    padding: Spacing.five,
    gap: Spacing.two,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.one,
  },
  avatarInitial: {
    color: NS.colors.accent,
    fontSize: 32,
    fontWeight: '900',
  },
  avatarHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  label: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: NS.colors.bg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    borderRadius: NS.radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    color: NS.colors.text,
    fontSize: 15,
  },
  textArea: {
    minHeight: 100,
  },
});
