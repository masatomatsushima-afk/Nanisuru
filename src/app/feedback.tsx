import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/premium-card';
import { ScreenBackground } from '@/components/ui/screen-background';
import { MVP_VERSION_LABEL, QA_USER_MESSAGES } from '@/constants/mvp-qa';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { devLog } from '@/lib/dev-log';

type FeedbackPayload = {
  version: string;
  liked: string;
  confusing: string;
  wantedFeatures: string;
  bugReport: string;
  submittedAt: string;
};

function FeedbackField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = true,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={NS.colors.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

export default function FeedbackScreen() {
  const insets = useSafeAreaInsets();
  const [liked, setLiked] = useState('');
  const [confusing, setConfusing] = useState('');
  const [wantedFeatures, setWantedFeatures] = useState('');
  const [bugReport, setBugReport] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    const payload: FeedbackPayload = {
      version: MVP_VERSION_LABEL,
      liked: liked.trim(),
      confusing: confusing.trim(),
      wantedFeatures: wantedFeatures.trim(),
      bugReport: bugReport.trim(),
      submittedAt: new Date().toISOString(),
    };

    const hasContent =
      payload.liked || payload.confusing || payload.wantedFeatures || payload.bugReport;

    if (!hasContent) {
      Alert.alert('入力してください', 'どれか1つ以上、感想を書いてください');
      return;
    }

    setSubmitting(true);
    devLog('[Feedback]', payload);
    setSubmitting(false);

    Alert.alert(QA_USER_MESSAGES.feedbackThanks, 'いただいた内容を開発の参考にします。', [
      {
        text: 'OK',
        onPress: () => router.back(),
      },
    ]);
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + Spacing.three,
              paddingBottom: insets.bottom + Spacing.six,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← 戻る</Text>
          </Pressable>

          <Text style={styles.title}>フィードバック</Text>
          <Text style={styles.subtitle}>
            Nanisuru MVP のテストにご協力ありがとうございます。気づいたことを自由に書いてください。
          </Text>

          <FeedbackField
            label="使いやすかったところ"
            value={liked}
            onChangeText={setLiked}
            placeholder="例）プラン生成が早くて分かりやすかった"
          />
          <FeedbackField
            label="分かりにくかったところ"
            value={confusing}
            onChangeText={setConfusing}
            placeholder="例）保存ボタンの場所が分かりにくかった"
          />
          <FeedbackField
            label="欲しい機能"
            value={wantedFeatures}
            onChangeText={setWantedFeatures}
            placeholder="例）友達とプランを共有したい"
          />
          <FeedbackField
            label="バグ報告"
            value={bugReport}
            onChangeText={setBugReport}
            placeholder="例）〇〇画面でタップしても反応しない"
          />

          <PrimaryButton
            label={submitting ? '送信中…' : '送信する'}
            onPress={handleSubmit}
            disabled={submitting}
          />

          <Text style={styles.version}>{MVP_VERSION_LABEL}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: {
    paddingHorizontal: NS.layout.screenPadding,
    maxWidth: NS.layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  backButtonText: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    color: NS.colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.one,
  },
  field: {
    gap: Spacing.one + 2,
  },
  label: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    color: NS.colors.text,
    fontSize: 15,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  inputMultiline: {
    minHeight: 96,
    paddingTop: Spacing.two + 2,
  },
  version: {
    color: NS.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
});
