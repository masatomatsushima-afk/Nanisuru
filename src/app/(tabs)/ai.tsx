import { useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/ui/fade-in-view';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const SAMPLE_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'user',
    content: '雨降ってきた',
  },
  {
    id: '2',
    role: 'assistant',
    content: '屋外プランを変更しますか？\n近くのカフェと美術館に変更できます。',
  },
];

function ChatHeader() {
  return (
    <FadeInView direction="down">
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>N</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Nanisuru AI</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.headerSubtitle}>お出かけアシスタント</Text>
          </View>
        </View>
      </View>
    </FadeInView>
  );
}

function MessageBubble({ message, index }: { message: Message; index: number }) {
  const isUser = message.role === 'user';

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).duration(450).springify()}
      style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAi]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>✦</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAi]}>
          {message.content}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function NanisuruAiScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.inner, { paddingTop: insets.top }]}>
        <ChatHeader />

        <ScrollView
          ref={scrollRef}
          style={styles.messagesScroll}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          <FadeInView>
            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeEyebrow}>コンシェルジュ</Text>
              <Text style={styles.welcomeTitle}>今日のプラン、お手伝いします</Text>
              <Text style={styles.welcomeText}>
                天気の変化や急な予定変更にも対応。いつでも相談してください。
              </Text>
            </View>
          </FadeInView>

          {SAMPLE_MESSAGES.map((message, index) => (
            <MessageBubble key={message.id} message={message} index={index} />
          ))}
        </ScrollView>

        <View
          style={[
            styles.inputBar,
            { paddingBottom: insets.bottom + BottomTabInset + Spacing.two },
          ]}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="メッセージを入力..."
              placeholderTextColor={NS.colors.textMuted}
              editable={false}
            />
            <Pressable style={styles.sendButton}>
              <Text style={styles.sendIcon}>↑</Text>
            </Pressable>
          </View>
          <Text style={styles.inputHint}>サンプル会話を表示中</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NS.colors.bg,
  },
  inner: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: NS.layout.screenPadding,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: NS.colors.border,
    backgroundColor: NS.colors.bg,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: NS.colors.accent,
    fontSize: 18,
    fontWeight: '800',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: NS.colors.success,
  },
  headerSubtitle: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: NS.layout.screenPadding,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
    maxWidth: NS.layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  welcomeCard: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    padding: Spacing.four,
    marginBottom: Spacing.two,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    ...NS.shadow.card,
  },
  welcomeEyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.two,
  },
  welcomeTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.two,
  },
  welcomeText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    maxWidth: '88%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  messageRowAi: {
    alignSelf: 'flex-start',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  aiAvatarText: {
    color: NS.colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  bubble: {
    borderRadius: NS.radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    maxWidth: '100%',
  },
  bubbleUser: {
    backgroundColor: NS.colors.accent,
    borderBottomRightRadius: 6,
    ...NS.shadow.accent,
  },
  bubbleAi: {
    backgroundColor: NS.colors.bgCard,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 24,
  },
  bubbleTextUser: {
    color: NS.colors.text,
    fontWeight: '500',
  },
  bubbleTextAi: {
    color: NS.colors.text,
    fontWeight: '500',
  },
  inputBar: {
    paddingHorizontal: NS.layout.screenPadding,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
    backgroundColor: NS.colors.bg,
    maxWidth: NS.layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingLeft: Spacing.three,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    color: NS.colors.text,
    fontSize: 15,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: NS.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  inputHint: {
    color: NS.colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
});
