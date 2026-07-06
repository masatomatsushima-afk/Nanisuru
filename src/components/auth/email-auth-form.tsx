import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type EmailAuthFormProps = {
  mode: 'login' | 'signup';
  onSubmitEmail: (email: string, password: string) => Promise<void>;
  onMagicLink?: (email: string) => Promise<void>;
  onForgotPassword?: (email: string) => Promise<void>;
  isLoading?: boolean;
};

export function EmailAuthForm({
  mode,
  onSubmitEmail,
  onMagicLink,
  onForgotPassword,
  isLoading = false,
}: EmailAuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const submitLabel = mode === 'login' ? 'ログイン' : '新規登録';

  const handleSubmit = async () => {
    await onSubmitEmail(email, password);
  };

  const handleMagicLink = async () => {
    if (!onMagicLink) return;
    await onMagicLink(email);
    setMagicLinkSent(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>メールアドレス</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="example@email.com"
        placeholderTextColor={NS.colors.textMuted}
        editable={!isLoading}
      />

      <Text style={styles.label}>パスワード</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType={mode === 'login' ? 'password' : 'newPassword'}
        placeholder="6文字以上"
        placeholderTextColor={NS.colors.textMuted}
        editable={!isLoading}
      />

      {mode === 'login' && onForgotPassword ? (
        <Pressable
          style={styles.linkWrap}
          onPress={() => void onForgotPassword(email)}
          disabled={isLoading}>
          <Text style={styles.linkText}>パスワードを忘れた方</Text>
        </Pressable>
      ) : null}

      <PrimaryButton
        label={isLoading ? '処理中…' : submitLabel}
        onPress={() => void handleSubmit()}
        disabled={isLoading}
      />

      {onMagicLink ? (
        <Pressable
          style={styles.magicLinkButton}
          onPress={() => void handleMagicLink()}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color={NS.colors.accent} />
          ) : (
            <Text style={styles.magicLinkText}>
              {magicLinkSent ? 'ログインリンクを送信しました' : 'メールでログインリンクを送る'}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  label: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: Spacing.one,
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
  linkWrap: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.one,
  },
  linkText: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  magicLinkButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  magicLinkText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
