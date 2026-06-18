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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, Colors, Spacing } from '@/constants/theme';

const theme = Colors.dark;
const accent = '#818CF8';

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
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAi]}>
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
    </View>
  );
}

export default function NanisuruAiScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <View style={[styles.inner, { paddingTop: insets.top }]}>
        <ChatHeader />

        <ScrollView
          ref={scrollRef}
          style={styles.messagesScroll}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeEyebrow}>CONCIERGE</Text>
            <Text style={styles.welcomeTitle}>今日のプラン、お手伝いします</Text>
            <Text style={styles.welcomeText}>
              天気の変化や急な予定変更にも対応。いつでも相談してください。
            </Text>
          </View>

          {SAMPLE_MESSAGES.map((message) => (
            <MessageBubble key={message.id} message={message} />
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
              placeholderTextColor="#6B7280"
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
    backgroundColor: '#0A0A0B',
  },
  inner: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#0A0A0B',
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: accent,
    fontSize: 18,
    fontWeight: '800',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
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
    backgroundColor: '#34D399',
  },
  headerSubtitle: {
    color: theme.textSecondary,
    fontSize: 13,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  welcomeCard: {
    backgroundColor: '#121214',
    borderRadius: 20,
    padding: Spacing.four,
    marginBottom: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.18)',
  },
  welcomeEyebrow: {
    color: accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: Spacing.two,
  },
  welcomeTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  welcomeText: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 22,
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
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  aiAvatarText: {
    color: accent,
    fontSize: 12,
    fontWeight: '700',
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    maxWidth: '100%',
  },
  bubbleUser: {
    backgroundColor: accent,
    borderBottomRightRadius: 6,
    shadowColor: accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bubbleAi: {
    backgroundColor: '#1A1A1D',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 24,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  bubbleTextAi: {
    color: theme.text,
    fontWeight: '500',
  },
  inputBar: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#0A0A0B',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#161618',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.backgroundSelected,
    paddingLeft: Spacing.three,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    color: theme.text,
    fontSize: 15,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  inputHint: {
    color: theme.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
});
