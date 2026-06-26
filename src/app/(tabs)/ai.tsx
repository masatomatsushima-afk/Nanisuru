import { router, useFocusEffect } from 'expo-router';
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

import { TripFolderCreateSheet } from '@/components/trip-folder-create-sheet';
import { TripFolderSelector } from '@/components/trip-folder-selector';
import { ScreenBackground } from '@/components/ui/screen-background';
import { FadeInView } from '@/components/ui/fade-in-view';
import { AppErrorBanner } from '@/components/app-error-banner';
import { NearbyPlacesSection } from '@/components/nearby-places-section';
import { PrimaryButton } from '@/components/ui/premium-card';
import { NS, gradientStyle } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { buildSecretaryWelcomeMessageGeneric } from '@/lib/active-trip';
import { APP_MESSAGES, getErrorMessage } from '@/lib/app-errors';
import { isGoogleMapsConfigured } from '@/lib/env';
import { fetchNearbyFromCurrentLocation } from '@/lib/nearby-places';
import { isOpenAiConfigured, sendSecretaryMessage } from '@/lib/travel-secretary';
import {
  buildTripFolderEnrichedContext,
  buildWelcomeMessageForFolder,
  getLastSelectedTripFolderId,
  setLastSelectedTripFolderId,
} from '@/lib/trip-folder-context';
import {
  buildTargetFromIntent,
  detectItineraryEditIntent,
} from '@/lib/itinerary-edit-intent';
import { saveItineraryEdit } from '@/lib/itinerary-edits';
import {
  applyPartialEditResult,
  previewPartialItineraryEdit,
} from '@/lib/itinerary-partial-edit';
import {
  fetchTripAssistantMessages,
  fetchUserTripFolders,
  saveTripAssistantMessage,
  updateTripFolderPlanPayload,
} from '@/lib/trip-folders';
import { updateTrip } from '@/lib/saved-trips';
import { buildItineraryItemId } from '@/types/itinerary-edit';
import type { ItineraryEditProposal } from '@/types/itinerary-edit';
import type { NearbyPlacesContext } from '@/types/nearby-places';
import type { SecretaryMessage } from '@/types/travel-secretary';
import { SECRETARY_QUICK_PROMPTS } from '@/types/travel-secretary';
import { TRIP_FOLDER_QUICK_ACTIONS, type TripFolder } from '@/types/trip-folder';
import type { ActiveTripContext } from '@/types/travel-secretary';

function createMessage(role: SecretaryMessage['role'], content: string): SecretaryMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function ChatHeader({ folderTitle }: { folderTitle: string | null }) {
  return (
    <FadeInView direction="down">
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>🧳</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>AI旅行秘書</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, folderTitle && styles.statusDotActive]} />
            <Text style={styles.headerSubtitle}>
              {folderTitle
                ? `${folderTitle} · 旅行フォルダ連携中 ✨`
                : '旅行フォルダを選ぶと、その旅だけの相談ができます'}
            </Text>
          </View>
        </View>
      </View>
    </FadeInView>
  );
}

function MessageBubble({
  message,
  index,
  onApplyEditProposal,
  isApplyingEdit,
}: {
  message: SecretaryMessage;
  index: number;
  onApplyEditProposal?: (messageId: string, proposal: ItineraryEditProposal) => void;
  isApplyingEdit?: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 60, 300)).duration(400).springify()}
      style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAi]}>
      {!isUser ? (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>🛎</Text>
        </View>
      ) : null}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAi]}>
          {message.content}
        </Text>
        {!isUser && message.editProposal && onApplyEditProposal ? (
          <View style={styles.editProposalBox}>
            <Text style={styles.editProposalLabel}>プラン変更案</Text>
            <Text style={styles.editProposalSummary}>{message.editProposal.preview.summary}</Text>
            <PrimaryButton
              label={isApplyingEdit ? '反映中...' : 'この変更をプランに反映'}
              onPress={() => onApplyEditProposal(message.id, message.editProposal!)}
              disabled={isApplyingEdit}
            />
          </View>
        ) : null}
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

function FolderBanner({ folder }: { folder: TripFolder }) {
  return (
    <View style={styles.tripBanner}>
      <Text style={styles.tripBannerLabel}>📁 旅行ワークスペース</Text>
      <Text style={styles.tripBannerTitle} numberOfLines={1}>
        {folder.title}
      </Text>
      <Text style={styles.tripBannerMeta}>
        {folder.destination}
        {folder.durationLabel ? ` · ${folder.durationLabel}` : ''}
        {folder.companionType ? ` · ${folder.companionType}` : ''}
      </Text>
      {folder.budget ? (
        <Text style={styles.tripBannerMeta}>予算 {folder.budget} {folder.currency}</Text>
      ) : null}
    </View>
  );
}

export default function TravelSecretaryScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { session, isConfigured } = useAuth();

  const [folders, setFolders] = useState<TripFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<TripFolder | null>(null);
  const [tripContext, setTripContext] = useState<ActiveTripContext | null>(null);
  const [folderBrief, setFolderBrief] = useState<string | null>(null);
  const [messages, setMessages] = useState<SecretaryMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlacesContext | null>(null);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [lastFailedHistory, setLastFailedHistory] = useState<SecretaryMessage[] | null>(null);
  const [retryAction, setRetryAction] = useState<'nearby' | 'message' | null>(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [applyingEditMessageId, setApplyingEditMessageId] = useState<string | null>(null);

  const loadFolderContext = useCallback(async (folder: TripFolder) => {
    const enriched = await buildTripFolderEnrichedContext(folder);
    setTripContext(enriched.tripContext);
    setFolderBrief(enriched.extendedBrief);
    return enriched;
  }, []);

  const loadMessagesForFolder = useCallback(
    async (folder: TripFolder) => {
      setIsLoadingMessages(true);
      try {
        const stored = await fetchTripAssistantMessages(folder.id);
        const enriched = await loadFolderContext(folder);

        if (stored.length === 0) {
          setMessages([
            createMessage('assistant', buildWelcomeMessageForFolder(folder, enriched.tripContext)),
          ]);
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
      } catch {
        const enriched = await loadFolderContext(folder);
        setMessages([
          createMessage('assistant', buildWelcomeMessageForFolder(folder, enriched.tripContext)),
        ]);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [loadFolderContext],
  );

  const selectFolder = useCallback(
    async (folderId: string, folderList?: TripFolder[]) => {
      const list = folderList ?? folders;
      const folder = list.find((item) => item.id === folderId);
      if (!folder) return;

      setSelectedFolderId(folderId);
      setSelectedFolder(folder);
      await setLastSelectedTripFolderId(folderId);
      await loadMessagesForFolder(folder);
    },
    [folders, loadMessagesForFolder],
  );

  const refreshFolders = useCallback(async () => {
    if (!session || !isConfigured) {
      setFolders([]);
      setSelectedFolderId(null);
      setSelectedFolder(null);
      setMessages([createMessage('assistant', buildSecretaryWelcomeMessageGeneric())]);
      return;
    }

    setIsLoadingFolders(true);
    try {
      const loaded = await fetchUserTripFolders();
      setFolders(loaded);

      if (loaded.length === 0) {
        setSelectedFolderId(null);
        setSelectedFolder(null);
        setTripContext(null);
        setFolderBrief(null);
        setMessages([createMessage('assistant', buildSecretaryWelcomeMessageGeneric())]);
        return;
      }

      const lastId = await getLastSelectedTripFolderId();
      const targetId =
        lastId && loaded.some((folder) => folder.id === lastId) ? lastId : loaded[0].id;
      await selectFolder(targetId, loaded);
    } catch {
      setFolders([]);
    } finally {
      setIsLoadingFolders(false);
    }
  }, [isConfigured, selectFolder, session]);

  useFocusEffect(
    useCallback(() => {
      void refreshFolders();
    }, [refreshFolders]),
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
      const assistantText =
        `${context.locationLabel} 周辺のスポットを${context.places.length}件見つけました。\n` +
        'カフェ・レストラン・観光スポット・公園・バーを距離・徒歩時間付きで表示しています。\n' +
        '「近くでランチできるところは？」など、そのまま相談してください。';

      setMessages((prev) => [...prev, createMessage('assistant', assistantText)]);

      if (selectedFolderId) {
        await saveTripAssistantMessage(selectedFolderId, 'assistant', assistantText);
      }
      scrollToEnd();
    } catch (err) {
      setError(getErrorMessage(err));
      setRetryAction('nearby');
    } finally {
      setIsSearchingNearby(false);
    }
  };

  const submitSecretaryMessage = async (
    trimmed: string,
    history: SecretaryMessage[],
    options?: { skipUserSave?: boolean },
  ) => {
    setError(null);
    setRetryAction(null);
    setLastFailedPrompt(null);
    setLastFailedHistory(null);
    setIsLoading(true);
    scrollToEnd();

    if (selectedFolderId && !options?.skipUserSave) {
      await saveTripAssistantMessage(selectedFolderId, 'user', trimmed);
    }

    try {
      const reply = await sendSecretaryMessage({
        userMessage: trimmed,
        history,
        nearbyPlaces,
        tripContext: selectedFolder ? tripContext : null,
        folderBrief: selectedFolder ? folderBrief : null,
      });

      let editProposal: ItineraryEditProposal | undefined;
      if (selectedFolder?.planPayload?.days?.length) {
        const intent = detectItineraryEditIntent(trimmed, selectedFolder.planPayload.days);
        if (intent) {
          const target = buildTargetFromIntent(selectedFolder.planPayload.days, intent);
          if (target) {
            try {
              const preview = await previewPartialItineraryEdit({
                payload: selectedFolder.planPayload,
                target,
                action: intent.action,
                userRequest: intent.editRequest,
              });
              editProposal = {
                ...preview,
                target,
                editRequest: intent.editRequest,
                action: intent.action,
              };
            } catch {
              // テキスト回答のみ表示
            }
          }
        }
      }

      const assistantMessage: SecretaryMessage = {
        ...createMessage('assistant', reply),
        editProposal,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (selectedFolderId) {
        await saveTripAssistantMessage(selectedFolderId, 'assistant', reply);
      }
      scrollToEnd();
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      setLastFailedPrompt(trimmed);
      setLastFailedHistory(history);
      setRetryAction('message');
      setMessages((prev) => [...prev, createMessage('assistant', `申し訳ありません。${message}`)]);
      scrollToEnd();
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyEditProposal = async (messageId: string, proposal: ItineraryEditProposal) => {
    if (!selectedFolder?.planPayload || applyingEditMessageId) return;

    setApplyingEditMessageId(messageId);
    setError(null);

    try {
      const nextPayload = applyPartialEditResult(selectedFolder.planPayload, proposal);
      const updatedFolder = await updateTripFolderPlanPayload(selectedFolder.id, nextPayload);

      if (updatedFolder) {
        setSelectedFolder(updatedFolder);
        setFolders((prev) =>
          prev.map((folder) => (folder.id === updatedFolder.id ? updatedFolder : folder)),
        );
        const enriched = await loadFolderContext(updatedFolder);
        setTripContext(enriched.tripContext);
        setFolderBrief(enriched.extendedBrief);
      }

      if (selectedFolder.savedTripId) {
        await updateTrip(selectedFolder.savedTripId, nextPayload);
      }

      await saveItineraryEdit({
        tripId: selectedFolder.savedTripId,
        dayIndex: proposal.target.dayIndex,
        itemId: buildItineraryItemId(proposal.target),
        editRequest: proposal.editRequest,
        beforeData: {
          day: proposal.preview.beforeDay,
          item: proposal.preview.beforeItem,
        },
        afterData: {
          day: proposal.preview.afterDay,
          item: proposal.preview.afterItem,
        },
      });

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content: `${message.content}\n\n✅ プランに変更を反映しました。`,
                editProposal: undefined,
              }
            : message,
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setApplyingEditMessageId(null);
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    if (!selectedFolderId) {
      setError('まず旅行フォルダを選ぶか、新しく作成してください。');
      return;
    }

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
      void submitSecretaryMessage(lastFailedPrompt, lastFailedHistory, { skipUserSave: true });
    }
  };

  const handleFolderCreated = async (folder: TripFolder) => {
    const nextFolders = [folder, ...folders.filter((item) => item.id !== folder.id)];
    setFolders(nextFolders);
    await selectFolder(folder.id, nextFolders);
  };

  const quickPrompts = selectedFolder ? TRIP_FOLDER_QUICK_ACTIONS : SECRETARY_QUICK_PROMPTS;
  const canSend = input.trim().length > 0 && !isLoading && Boolean(selectedFolderId);

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <View style={[styles.inner, { paddingTop: insets.top }]}>
          <ChatHeader folderTitle={selectedFolder?.title ?? null} />

          {session && isConfigured ? (
            <>
              <TripFolderSelector
                folders={folders}
                selectedFolderId={selectedFolderId}
                onSelect={(folderId) => void selectFolder(folderId)}
                onCreateNew={() => setShowCreateSheet(true)}
              />
              <Pressable style={styles.createFolderLink} onPress={() => setShowCreateSheet(true)}>
                <Text style={styles.createFolderLinkText}>＋ 新しい旅行フォルダを作る</Text>
              </Pressable>
            </>
          ) : null}

          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={scrollToEnd}>
            {!session ? (
              <FadeInView>
                <View style={styles.noTripCard}>
                  <Text style={styles.noTripTitle}>ログインが必要です</Text>
                  <Text style={styles.noTripText}>
                    旅行フォルダごとのAI秘書を使うには、ログインしてください。
                  </Text>
                  <PrimaryButton label="ログイン" onPress={() => router.push('/login')} />
                </View>
              </FadeInView>
            ) : !isConfigured ? (
              <View style={styles.noTripCard}>
                <Text style={styles.noTripText}>Supabase の設定後、旅行フォルダが使えます。</Text>
              </View>
            ) : isLoadingFolders ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={NS.colors.accent} />
                <Text style={styles.loadingText}>フォルダを読み込み中...</Text>
              </View>
            ) : folders.length === 0 ? (
              <FadeInView>
                <View style={styles.noTripCard}>
                  <Text style={styles.noTripEmoji}>🧳</Text>
                  <Text style={styles.noTripTitle}>まだ旅行フォルダがありません</Text>
                  <Text style={styles.noTripText}>
                    まずは旅行を作るか、保存済みプランからフォルダを作成しましょう
                  </Text>
                  <PrimaryButton
                    label="新しい旅行フォルダを作る"
                    onPress={() => setShowCreateSheet(true)}
                  />
                </View>
              </FadeInView>
            ) : null}

            {selectedFolder ? <FolderBanner folder={selectedFolder} /> : null}

            {selectedFolder ? (
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
            ) : null}

            {nearbyPlaces ? <NearbyPlacesSection context={nearbyPlaces} /> : null}

            {isLoadingMessages ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={NS.colors.accent} />
              </View>
            ) : (
              messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  index={index}
                  onApplyEditProposal={
                    selectedFolder?.planPayload ? handleApplyEditProposal : undefined
                  }
                  isApplyingEdit={applyingEditMessageId === message.id}
                />
              ))
            )}

            {isLoading ? <TypingIndicator /> : null}
          </ScrollView>

          <View
            style={[
              styles.inputArea,
              { paddingBottom: insets.bottom + BottomTabInset + Spacing.two },
            ]}>
            <QuickPrompts prompts={quickPrompts} onSelect={sendMessage} disabled={isLoading} />

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
                  selectedFolder
                    ? 'この旅行について、そのまま相談できます'
                    : '旅行フォルダを選んでください'
                }
                placeholderTextColor={NS.colors.textMuted}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={500}
                editable={!isLoading && Boolean(selectedFolderId)}
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

      <TripFolderCreateSheet
        visible={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        onCreated={(folder) => void handleFolderCreated(folder)}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
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
    backgroundColor: 'rgba(255,255,255,0.82)',
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
    fontSize: 22,
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
    flex: 1,
  },
  createFolderLink: {
    alignSelf: 'center',
    paddingBottom: Spacing.two,
  },
  createFolderLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: NS.colors.accent,
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
    borderRadius: NS.radius.lg,
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
    gap: Spacing.two,
    alignItems: 'center',
  },
  noTripEmoji: {
    fontSize: 32,
  },
  noTripTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  noTripText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  loadingText: {
    color: NS.colors.textMuted,
    fontSize: 13,
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
    backgroundColor: NS.colors.coral,
    borderBottomRightRadius: 6,
    ...gradientStyle('primaryButton'),
    ...NS.shadow.pop,
  },
  bubbleAi: {
    backgroundColor: NS.colors.bgElevated,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: NS.colors.border,
    ...NS.shadow.card,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 24,
  },
  bubbleTextUser: {
    color: NS.colors.textOnAccent,
    fontWeight: '600',
  },
  bubbleTextAi: {
    color: NS.colors.text,
    fontWeight: '500',
  },
  editProposalBox: {
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
    gap: Spacing.two,
  },
  editProposalLabel: {
    color: NS.colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  editProposalSummary: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
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
});
