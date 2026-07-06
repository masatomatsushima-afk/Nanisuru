import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { TripAssistantActionPreviewModal } from '@/components/trip-assistant-action-preview-modal';
import { PrimaryButton } from '@/components/ui/premium-card';
import { ScreenBackground } from '@/components/ui/screen-background';
import { LoadingState } from '@/components/ui/state-cards';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { isOpenAiConfigured } from '@/lib/travel-secretary';
import { detectTripAssistantAction } from '@/lib/trip-assistant-action';
import { applyTripAssistantAction } from '@/lib/trip-assistant-apply';
import { buildTripAssistantContext } from '@/lib/trip-assistant-context';
import { sendTripAssistantMessage } from '@/lib/trip-assistant-chat';
import { getTripById, savedTripPayloadToPlanParams, savedTripToPlanParams } from '@/lib/saved-trips';
import { setLastSelectedTripFolderId } from '@/lib/trip-folder-context';
import {
  fetchTripAssistantMessages,
  getTripFolderById,
  saveTripAssistantMessage,
} from '@/lib/trip-folders';
import { formatTripDateRangeLabel } from '@/lib/trip-schedule';
import {
  TRIP_ASSISTANT_DAY_MODE_PROMPTS,
  TRIP_ASSISTANT_QUICK_PROMPTS,
  TRIP_ASSISTANT_WELCOME_MESSAGE,
  type TripAssistantAction,
  type TripAssistantChatMessage,
  type TripAssistantContext,
} from '@/types/trip-assistant';
import type { TripDayModeAssistantContext } from '@/types/trip-day-mode';
import type { SavedTrip } from '@/types/trip';
import type { TripFolder } from '@/types/trip-folder';

function createMessage(
  role: TripAssistantChatMessage['role'],
  content: string,
  extras?: Partial<TripAssistantChatMessage>,
): TripAssistantChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extras,
  };
}

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function ChatHeader({ folder, onBack }: { folder: TripFolder; onBack: () => void }) {
  const dateLabel =
    formatTripDateRangeLabel(folder.departureDate, folder.returnDate) ??
    folder.durationLabel ??
    folder.destination;

  return (
    <View style={styles.header}>
      <Pressable style={styles.backButton} onPress={onBack} hitSlop={8}>
        <Text style={styles.backButtonText}>←</Text>
      </Pressable>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>旅行秘書</Text>
        <Text style={styles.headerTripTitle} numberOfLines={1}>
          {folder.title}
        </Text>
        <Text style={styles.headerMeta} numberOfLines={1}>
          {folder.destination} · {dateLabel}
        </Text>
      </View>
    </View>
  );
}

function MessageBubble({
  message,
  index,
  onApplyAction,
  onShowDetails,
  onViewUpdatedPlan,
  applyingActionId,
}: {
  message: TripAssistantChatMessage;
  index: number;
  onApplyAction: (message: TripAssistantChatMessage) => void;
  onShowDetails: (message: TripAssistantChatMessage) => void;
  onViewUpdatedPlan: () => void;
  applyingActionId: string | null;
}) {
  const isUser = message.role === 'user';
  const action = message.assistantAction;
  const isApplying = applyingActionId === message.id;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 50, 250)).duration(350).springify()}
      style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAi]}>
      {!isUser ? (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>🛎</Text>
        </View>
      ) : null}
      <View style={styles.bubbleWrap}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAi]}>
            {message.content}
          </Text>

          {!isUser && action && !message.applied ? (
            <View style={styles.actionBox}>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionSummary}>
                {action.beforeItem?.activity ?? '—'} → {action.afterItem?.activity ?? '—'}
              </Text>
              <PrimaryButton
                label={isApplying ? '反映中…' : 'この変更をプランに反映'}
                onPress={() => onApplyAction(message)}
                disabled={Boolean(applyingActionId)}
              />
              <Pressable
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.secondaryActionPressed]}
                onPress={() => onShowDetails(message)}
                disabled={Boolean(applyingActionId)}>
                <Text style={styles.secondaryActionText}>詳しく見る</Text>
              </Pressable>
            </View>
          ) : null}

          {!isUser && message.applied ? (
            <View style={styles.actionBox}>
              <Pressable
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.secondaryActionPressed]}
                onPress={onViewUpdatedPlan}>
                <Text style={styles.secondaryActionText}>更新後のプランを見る</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampAi]}>
          {formatMessageTime(message.createdAt)}
        </Text>
      </View>
    </Animated.View>
  );
}

function QuickPromptChips({
  prompts,
  onSelect,
  disabled,
}: {
  prompts: readonly string[];
  onSelect: (prompt: string) => void;
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
            disabled && styles.quickChipDisabled,
            pressed && !disabled && styles.quickChipPressed,
          ]}
          disabled={disabled}
          onPress={() => onSelect(prompt)}>
          <Text style={styles.quickChipText}>{prompt}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function TripAssistantScreen() {
  const insets = useSafeAreaInsets();
  const { folderId, dayModeContext: dayModeContextParam } = useLocalSearchParams<{
    folderId: string;
    dayModeContext?: string;
  }>();
  const { session } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const submitInFlightRef = useRef(false);

  const [folder, setFolder] = useState<TripFolder | null>(null);
  const [linkedTrip, setLinkedTrip] = useState<SavedTrip | null>(null);
  const [assistantContext, setAssistantContext] = useState<TripAssistantContext | null>(null);
  const [messages, setMessages] = useState<TripAssistantChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoadingScreen, setIsLoadingScreen] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [previewAction, setPreviewAction] = useState<TripAssistantAction | null>(null);
  const [previewMessageId, setPreviewMessageId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [applyingActionId, setApplyingActionId] = useState<string | null>(null);
  const [dayModeContext, setDayModeContext] = useState<TripDayModeAssistantContext | null>(null);

  const [latestPayloadAfterApply, setLatestPayloadAfterApply] = useState<SavedTrip['payload'] | null>(
    null,
  );

  useEffect(() => {
    if (!dayModeContextParam?.trim()) {
      setDayModeContext(null);
      return;
    }

    try {
      setDayModeContext(JSON.parse(dayModeContextParam) as TripDayModeAssistantContext);
    } catch {
      setDayModeContext(null);
    }
  }, [dayModeContextParam]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const refreshContext = useCallback(async (loadedFolder: TripFolder, trip: SavedTrip | null) => {
    const context = await buildTripAssistantContext(loadedFolder, trip);
    setAssistantContext(context);
    return context;
  }, []);

  const loadScreen = useCallback(async () => {
    if (!folderId?.trim()) {
      setScreenError('フォルダが見つかりません');
      setIsLoadingScreen(false);
      return;
    }

    setIsLoadingScreen(true);
    setScreenError(null);
    setError(null);

    try {
      const loadedFolder = await getTripFolderById(folderId.trim());
      if (!loadedFolder) {
        setScreenError('旅行秘書フォルダが見つかりません');
        setFolder(null);
        return;
      }

      setFolder(loadedFolder);
      await setLastSelectedTripFolderId(loadedFolder.id);

      const trip =
        loadedFolder.savedTripId && session ? await getTripById(loadedFolder.savedTripId) : null;
      setLinkedTrip(trip);
      await refreshContext(loadedFolder, trip);

      try {
        const stored = await fetchTripAssistantMessages(loadedFolder.id);
        if (stored.length === 0) {
          setMessages([createMessage('assistant', TRIP_ASSISTANT_WELCOME_MESSAGE)]);
        } else {
          setMessages(
            stored.map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              createdAt: message.createdAt,
            })),
          );
        }
      } catch (loadMessagesError) {
        console.warn('[TripAssistant] message history unavailable', loadMessagesError);
        setMessages([createMessage('assistant', TRIP_ASSISTANT_WELCOME_MESSAGE)]);
      }
    } catch (err) {
      setScreenError(err instanceof Error ? err.message : '読み込みに失敗しました');
      setFolder(null);
    } finally {
      setIsLoadingScreen(false);
    }
  }, [folderId, refreshContext, session]);

  useEffect(() => {
    void loadScreen();
  }, [loadScreen]);

  useEffect(() => {
    if (!isLoadingScreen) scrollToEnd();
  }, [isLoadingScreen, messages.length, isThinking, scrollToEnd]);

  const effectiveContext = useMemo(() => {
    if (!assistantContext) return null;
    if (!dayModeContext) return assistantContext;
    return { ...assistantContext, dayModeContext };
  }, [assistantContext, dayModeContext]);

  const quickPrompts = dayModeContext ? TRIP_ASSISTANT_DAY_MODE_PROMPTS : TRIP_ASSISTANT_QUICK_PROMPTS;

  const openPreviewForMessage = (message: TripAssistantChatMessage) => {
    if (!message.assistantAction) return;
    setPreviewAction(message.assistantAction);
    setPreviewMessageId(message.id);
    setShowPreview(true);
  };

  const openViewUpdatedPlan = () => {
    if (!assistantContext?.latestPlan) return;

    if (linkedTrip) {
      router.push({
        pathname: '/plan-detail',
        params: savedTripToPlanParams({
          ...linkedTrip,
          payload: latestPayloadAfterApply ?? linkedTrip.payload,
        }),
      });
      return;
    }

    router.push({
      pathname: '/plan-detail',
      params: savedTripPayloadToPlanParams(
        latestPayloadAfterApply ?? assistantContext.latestPlan,
        folder?.savedTripId,
      ),
    });
  };

  const handleApplyAction = async () => {
    if (!previewAction || !previewMessageId || !folder || !effectiveContext || applyingActionId) {
      return;
    }

    setApplyingActionId(previewMessageId);
    setError(null);

    try {
      const { nextPayload, updatedFolder } = await applyTripAssistantAction({
        action: previewAction,
        context: effectiveContext,
        folder,
      });

      if (updatedFolder) {
        setFolder(updatedFolder);
      }

      setLatestPayloadAfterApply(nextPayload);
      const trip =
        updatedFolder?.savedTripId && session
          ? await getTripById(updatedFolder.savedTripId)
          : linkedTrip
            ? { ...linkedTrip, payload: nextPayload }
            : null;
      if (trip) setLinkedTrip(trip);
      await refreshContext(updatedFolder ?? folder, trip);

      setMessages((prev) =>
        prev.map((message) =>
          message.id === previewMessageId
            ? {
                ...message,
                applied: true,
                assistantAction: undefined,
                content: `${message.content}\n\nプランに反映しました`,
              }
            : message,
        ),
      );

      setShowPreview(false);
      setPreviewAction(null);
      setPreviewMessageId(null);
      scrollToEnd();
    } catch {
      setError('変更の反映に失敗しました。もう一度お試しください。');
    } finally {
      setApplyingActionId(null);
    }
  };

  const submitMessage = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (
      !trimmed ||
      isThinking ||
      submitInFlightRef.current ||
      !effectiveContext ||
      !folder
    ) {
      return;
    }

    if (!isOpenAiConfigured()) {
      setError('AI設定が未完了です。OpenAI APIキーを設定してください。');
      return;
    }

    submitInFlightRef.current = true;
    const userMessage = createMessage('user', trimmed);
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsThinking(true);
    scrollToEnd();

    try {
      if (session) {
        await saveTripAssistantMessage(folder.id, 'user', trimmed).catch((saveError) => {
          console.warn('[TripAssistant] failed to save user message', saveError);
        });
      }

      const response = await sendTripAssistantMessage({
        userMessage: trimmed,
        history: messages,
        context: effectiveContext,
      });

      let assistantAction: TripAssistantAction | null = null;
      try {
        assistantAction = await detectTripAssistantAction({
          userMessage: trimmed,
          assistantResponse: response,
          context: effectiveContext,
        });
      } catch (detectError) {
        console.warn('[TripAssistantAction] detection failed', detectError);
      }

      const assistantMessage = createMessage('assistant', response, {
        assistantAction: assistantAction ?? undefined,
      });
      setMessages((prev) => [...prev, assistantMessage]);

      if (session) {
        await saveTripAssistantMessage(folder.id, 'assistant', response).catch((saveError) => {
          console.warn('[TripAssistant] failed to save assistant message', saveError);
        });
      }
    } catch {
      setError('返答の生成に失敗しました。もう一度お試しください。');
    } finally {
      submitInFlightRef.current = false;
      setIsThinking(false);
      scrollToEnd();
    }
  };

  if (isLoadingScreen) {
    return (
      <ScreenBackground>
        <View style={[styles.loadingScreen, { paddingTop: insets.top + Spacing.four }]}>
          <LoadingState message="旅行秘書を準備中…" />
        </View>
      </ScreenBackground>
    );
  }

  if (screenError || !folder) {
    return (
      <ScreenBackground>
        <View style={[styles.loadingScreen, { paddingTop: insets.top + Spacing.four }]}>
          <Text style={styles.screenErrorText}>{screenError ?? 'フォルダが見つかりません'}</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>← 戻る</Text>
          </Pressable>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <ChatHeader folder={folder} onBack={() => router.back()} />

        <ScrollView
          ref={scrollRef}
          style={styles.messagesScroll}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              index={index}
              onApplyAction={openPreviewForMessage}
              onShowDetails={openPreviewForMessage}
              onViewUpdatedPlan={openViewUpdatedPlan}
              applyingActionId={applyingActionId}
            />
          ))}

          {isThinking ? (
            <View style={styles.thinkingRow}>
              <ActivityIndicator size="small" color={NS.colors.accent} />
              <Text style={styles.thinkingText}>旅行秘書が考えています…</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
          <QuickPromptChips
            prompts={quickPrompts}
            onSelect={(prompt) => void submitMessage(prompt)}
            disabled={isThinking}
          />

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="旅行について相談する"
              placeholderTextColor={NS.colors.textMuted}
              multiline
              maxLength={800}
              editable={!isThinking}
            />
            <Pressable
              style={({ pressed }) => [
                styles.sendButton,
                (isThinking || !input.trim()) && styles.sendButtonDisabled,
                pressed && !isThinking && input.trim() && styles.sendButtonPressed,
              ]}
              disabled={isThinking || !input.trim()}
              onPress={() => void submitMessage(input)}>
              <Text style={styles.sendButtonText}>送信</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <TripAssistantActionPreviewModal
        visible={showPreview}
        action={previewAction}
        applying={Boolean(applyingActionId)}
        onClose={() => {
          if (applyingActionId) return;
          setShowPreview(false);
          setPreviewAction(null);
          setPreviewMessageId(null);
        }}
        onApply={() => void handleApplyAction()}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadingScreen: { flex: 1, paddingHorizontal: NS.layout.screenPadding },
  screenErrorText: {
    color: NS.colors.danger,
    ...NS.typography.bodySm,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  backLink: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: NS.layout.screenPadding,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: NS.colors.border,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: NS.colors.bgElevated,
    borderWidth: 1,
    borderColor: NS.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { color: NS.colors.accent, fontSize: 18, fontWeight: '700' },
  headerText: { flex: 1, gap: 2 },
  headerTitle: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerTripTitle: { color: NS.colors.text, fontSize: 16, fontWeight: '800' },
  headerMeta: { color: NS.colors.textMuted, fontSize: 12, fontWeight: '600' },
  messagesScroll: { flex: 1 },
  messagesContent: {
    paddingHorizontal: NS.layout.screenPadding,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
    maxWidth: NS.layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    maxWidth: '88%',
  },
  messageRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  messageRowAi: { alignSelf: 'flex-start' },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAvatarText: { fontSize: 14 },
  bubbleWrap: { flexShrink: 1, gap: 4 },
  bubble: {
    borderRadius: NS.radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderWidth: 1,
  },
  bubbleUser: {
    backgroundColor: NS.colors.coral,
    borderColor: NS.colors.coral,
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: '#FFFCF8',
    borderColor: 'rgba(251, 113, 133, 0.18)',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: '#FFFFFF' },
  bubbleTextAi: { color: NS.colors.text },
  actionBox: {
    marginTop: Spacing.three,
    gap: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
  },
  actionTitle: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  actionSummary: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  secondaryAction: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  secondaryActionPressed: { opacity: 0.85 },
  secondaryActionText: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  timestamp: { fontSize: 10, color: NS.colors.textMuted },
  timestampUser: { textAlign: 'right' },
  timestampAi: { textAlign: 'left', marginLeft: 2 },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  thinkingText: { color: NS.colors.textMuted, fontSize: 13, fontWeight: '600' },
  errorBanner: {
    color: NS.colors.danger,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  quickPromptsContent: {
    paddingHorizontal: NS.layout.screenPadding,
    gap: Spacing.two,
  },
  quickChip: {
    backgroundColor: NS.colors.coralSoft,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.35)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  quickChipDisabled: { opacity: 0.5 },
  quickChipPressed: { opacity: 0.88 },
  quickChipText: { color: NS.colors.coral, fontSize: 13, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: NS.layout.screenPadding,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: NS.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  sendButton: {
    backgroundColor: NS.colors.coral,
    borderRadius: NS.radius.lg,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    minWidth: 64,
    alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.45 },
  sendButtonPressed: { opacity: 0.88 },
  sendButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
