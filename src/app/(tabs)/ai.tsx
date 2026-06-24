import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { AppErrorBanner } from '@/components/app-error-banner';
import { NearbyPlacesSection } from '@/components/nearby-places-section';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  buildSecretaryWelcomeMessage,
  buildSecretaryWelcomeMessageGeneric,
  getActiveTrip,
} from '@/lib/active-trip';
import { APP_MESSAGES, getErrorMessage } from '@/lib/app-errors';
import { isGoogleMapsConfigured } from '@/lib/env';
import { fetchNearbyFromCurrentLocation } from '@/lib/nearby-places';
import { isOpenAiConfigured, sendSecretaryMessage } from '@/lib/travel-secretary';
import type { NearbyPlacesContext } from '@/types/nearby-places';
import type { ActiveTripContext, SecretaryMessage } from '@/types/travel-secretary';
import { SECRETARY_QUICK_PROMPTS } from '@/types/travel-secretary';

function createMessage(role: SecretaryMessage['role'], content: string): SecretaryMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function createWelcomeMessage(trip: ActiveTripContext | null): SecretaryMessage {
  return createMessage(
    'assistant',
    trip ? buildSecretaryWelcomeMessage(trip) : buildSecretaryWelcomeMessageGeneric(),
  );
}

function ChatHeader({ hasActiveTrip }: { hasActiveTrip: boolean }) {
  return (
    <FadeInView direction="down">
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>秘</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>AI旅行秘書</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, hasActiveTrip && styles.statusDotActive]} />
            <Text style={styles.headerSubtitle}>
              {hasActiveTrip ? 'プラン連携中 · オンライン' : 'プラン未設定 · 一般相談モード'}
            </Text>
          </View>
        </View>
      </View>
    </FadeInView>
  );
}

function MessageBubble({ message, index }: { message: SecretaryMessage; index: number }) {
  const isUser = message.role === 'user';

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 60, 300)).duration(400).springify()}
      style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAi]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>🛎</Text>
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

function TypingIndicator() {
  return (
    <View style={[styles.messageRow, styles.messageRowAi]}>
      <View style={styles.aiAvatar}>
        <Text style={styles.aiAvatarText}>🛎</Text>
      </View>
      <View style={[styles.bubble, styles.bubbleAi, styles.typingBubble]}>
        <ActivityIndicator size="small" color={NS.colors.accent} />
        <Text style={styles.typingText}>考え中...</Text>
      </View>
    </View>
  );
}

function QuickPrompts({
  prompts,
  onSelect,
  disabled,
}: {
  prompts: readonly string[];
  onSelect: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.quickPromptsContent}>
      {prompts.map((prompt) => (
        <Pressable
          key={prompt}
          style={({ pressed }) => [
            styles.quickChip,
            pressed && styles.quickChipPressed,
            disabled && styles.quickChipDisabled,
          ]}
          onPress={() => onSelect(prompt)}
          disabled={disabled}>
          <Text style={styles.quickChipText}>{prompt}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ActiveTripBanner({ trip }: { trip: ActiveTripContext }) {
  return (
    <View style={styles.tripBanner}>
      <Text style={styles.tripBannerLabel}>把握済みの旅行プラン</Text>
      <Text style={styles.tripBannerTitle} numberOfLines={1}>
        {trip.title}
      </Text>
      <Text style={styles.tripBannerMeta}>
        {trip.location} · {trip.tripDuration} · {trip.personality}
      </Text>
      <Text style={styles.tripBannerMeta}>
        {trip.companion} · {trip.people}人 · 予算 {trip.details.totalBudget}
      </Text>
    </View>
  );
}

export default function TravelSecretaryScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<SecretaryMessage[]>(() => [
    createWelcomeMessage(null),
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTrip, setActiveTrip] = useState<ActiveTripContext | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlacesContext | null>(null);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [lastFailedHistory, setLastFailedHistory] = useState<SecretaryMessage[] | null>(null);
  const [retryAction, setRetryAction] = useState<'nearby' | 'message' | null>(null);

  const refreshActiveTrip = useCallback(async () => {
    const trip = await getActiveTrip();
    setActiveTrip(trip);
    setMessages((prev) => {
      const isOnlyWelcome = prev.length === 1 && prev[0].role === 'assistant';
      if (!isOnlyWelcome) return prev;
      return [createWelcomeMessage(trip)];
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshActiveTrip();
    }, [refreshActiveTrip]),
  );

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const searchNearbyFromCurrentLocation = async () => {
    if (isSearchingNearby) return;

    if (!isGoogleMapsConfigured()) {
      setError(APP_MESSAGES.googleMapsNotConfigured);
      setRetryAction(null);
      return;
    }

    setError(null);
    setRetryAction(null);
    setLastFailedPrompt(null);
    setIsSearchingNearby(true);
    scrollToEnd();

    try {
      const context = await fetchNearbyFromCurrentLocation();
      setNearbyPlaces(context);
      setMessages((prev) => [
        ...prev,
        createMessage(
          'assistant',
          `${context.locationLabel} 周辺のスポットを${context.places.length}件見つけました。\n` +
            'カフェ・レストラン・観光スポット・公園・バーを距離・徒歩時間付きで表示しています。\n' +
            '「近くでランチできるところは？」など、そのまま相談してください。',
        ),
      ]);
      scrollToEnd();
    } catch (err) {
      setError(getErrorMessage(err));
      setRetryAction('nearby');
    } finally {
      setIsSearchingNearby(false);
    }
  };

  const submitSecretaryMessage = async (trimmed: string, history: SecretaryMessage[]) => {
    setError(null);
    setRetryAction(null);
    setLastFailedPrompt(null);
    setLastFailedHistory(null);
    setIsLoading(true);
    scrollToEnd();

    try {
      const reply = await sendSecretaryMessage({
        userMessage: trimmed,
        history,
        nearbyPlaces,
      });
      setMessages((prev) => [...prev, createMessage('assistant', reply)]);
      scrollToEnd();
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      setLastFailedPrompt(trimmed);
      setLastFailedHistory(history);
      setRetryAction('message');
      setMessages((prev) => [
        ...prev,
        createMessage('assistant', `申し訳ありません。${message}`),
      ]);
      scrollToEnd();
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    if (!isOpenAiConfigured()) {
      setError(APP_MESSAGES.openAiNotConfigured);
      setRetryAction(null);
      return;
    }

    const userMessage = createMessage('user', trimmed);
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput('');
    await submitSecretaryMessage(trimmed, nextHistory);
  };

  const handleRetry = () => {
    if (retryAction === 'nearby') {
      void searchNearbyFromCurrentLocation();
      return;
    }
    if (retryAction === 'message' && lastFailedPrompt && lastFailedHistory && !isLoading) {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.content.startsWith('申し訳ありません。')) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      void submitSecretaryMessage(lastFailedPrompt, lastFailedHistory);
    }
  };

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <View style={[styles.inner, { paddingTop: insets.top }]}>
        <ChatHeader hasActiveTrip={Boolean(activeTrip)} />

        <ScrollView
          ref={scrollRef}
          style={styles.messagesScroll}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}>
          {activeTrip ? <ActiveTripBanner trip={activeTrip} /> : null}

          <Pressable
            style={({ pressed }) => [
              styles.nearbyButton,
              pressed && styles.nearbyButtonPressed,
              (isSearchingNearby || isLoading) && styles.nearbyButtonDisabled,
            ]}
            onPress={searchNearbyFromCurrentLocation}
            disabled={isSearchingNearby || isLoading}>
            {isSearchingNearby ? (
              <ActivityIndicator size="small" color={NS.colors.text} />
            ) : (
              <Text style={styles.nearbyButtonIcon}>📍</Text>
            )}
            <View style={styles.nearbyButtonTextWrap}>
              <Text style={styles.nearbyButtonTitle}>現在地から探す</Text>
              <Text style={styles.nearbyButtonSubtitle}>
                {isSearchingNearby
                  ? APP_MESSAGES.loadingSearchingPlaces
                  : nearbyPlaces
                    ? `${nearbyPlaces.locationLabel} · ${nearbyPlaces.places.length}件取得済み`
                    : 'GPS + Google Places で周辺スポットを検索'}
              </Text>
            </View>
          </Pressable>

          {nearbyPlaces ? <NearbyPlacesSection context={nearbyPlaces} /> : null}

          {!activeTrip ? (
            <FadeInView>
              <View style={styles.noTripCard}>
                <Text style={styles.noTripTitle}>プラン未連携</Text>
                <Text style={styles.noTripText}>
                  ホームでプランを生成すると、行程・予算・旅行タイプをもとに具体的なアドバイスができます。
                </Text>
              </View>
            </FadeInView>
          ) : null}

          {messages.map((message, index) => (
            <MessageBubble key={message.id} message={message} index={index} />
          ))}

          {isLoading ? <TypingIndicator /> : null}
        </ScrollView>

        <View style={[styles.inputArea, { paddingBottom: insets.bottom + BottomTabInset + Spacing.two }]}>
          <QuickPrompts
            prompts={SECRETARY_QUICK_PROMPTS}
            onSelect={sendMessage}
            disabled={isLoading}
          />

          {error ? (
            <AppErrorBanner
              message={error}
              onRetry={retryAction ? handleRetry : undefined}
            />
          ) : null}

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder={
                activeTrip
                  ? '行程の変更、予算、天気…そのまま相談できます'
                  : '旅行の相談を入力...'
              }
              placeholderTextColor={NS.colors.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              editable={!isLoading}
              onSubmitEditing={() => sendMessage(input)}
              blurOnSubmit={false}
            />
            <Pressable
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
              onPress={() => sendMessage(input)}
              disabled={!canSend}>
              {isLoading ? (
                <ActivityIndicator size="small" color={NS.colors.text} />
              ) : (
                <Text style={styles.sendIcon}>↑</Text>
              )}
            </Pressable>
          </View>
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
    backgroundColor: NS.colors.textMuted,
  },
  statusDotActive: {
    backgroundColor: NS.colors.success,
  },
  headerSubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 12,
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
  tripBanner: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    marginBottom: Spacing.one,
  },
  tripBannerLabel: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  tripBannerTitle: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  tripBannerMeta: {
    color: NS.colors.textSecondary,
    fontSize: 12,
  },
  nearbyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: NS.colors.successSoft,
    borderRadius: NS.radius.lg,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    marginBottom: Spacing.one,
  },
  nearbyButtonPressed: {
    opacity: 0.88,
  },
  nearbyButtonDisabled: {
    opacity: 0.6,
  },
  nearbyButtonIcon: {
    fontSize: 22,
  },
  nearbyButtonTextWrap: {
    flex: 1,
  },
  nearbyButtonTitle: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  nearbyButtonSubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  noTripCard: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: NS.colors.border,
    marginBottom: Spacing.two,
  },
  noTripTitle: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  noTripText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
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
    fontSize: 13,
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
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 14,
  },
  typingText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
  },
  inputArea: {
    paddingHorizontal: NS.layout.screenPadding,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
    backgroundColor: NS.colors.bg,
    maxWidth: NS.layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  quickPromptsContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  quickChip: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
  },
  quickChipPressed: {
    opacity: 0.85,
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  quickChipDisabled: {
    opacity: 0.5,
  },
  quickChipText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingLeft: Spacing.three,
    paddingRight: 6,
    paddingVertical: 6,
    minHeight: 48,
  },
  input: {
    flex: 1,
    color: NS.colors.text,
    fontSize: 15,
    paddingVertical: 8,
    maxHeight: 120,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: NS.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    color: NS.colors.danger,
    fontSize: 12,
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
});
